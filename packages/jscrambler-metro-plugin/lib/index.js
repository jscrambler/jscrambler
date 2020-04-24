const {emptyDir, remove, mkdirp, readFile, writeFile} = require('fs-extra');
const jscrambler = require('jscrambler').default;
const {Command} = require('commander');
const fs = require('fs');
const path = require('path');
const metroSourceMap = require('metro-source-map');
const sourceMap = require('source-map');
const readline = require('readline');
const {Readable} = require('stream');

const BUNDLE_CMD = 'bundle';
const BUNDLE_OUTPUT_CLI_ARG = '--bundle-output';
const BUNDLE_SOURCEMAP_OUTPUT_CLI_ARG = '--sourcemap-output';
const BUNDLE_DEV_CLI_ARG = '--dev';

const JSCRAMBLER_CLIENT_ID = 6;
const JSCRAMBLER_TEMP_FOLDER = '.jscrambler';
const JSCRAMBLER_DIST_TEMP_FOLDER = `${JSCRAMBLER_TEMP_FOLDER}/dist/`;
const JSCRAMBLER_SRC_TEMP_FOLDER = `${JSCRAMBLER_TEMP_FOLDER}/src`;
const JSCRAMBLER_PROTECTION_ID_FILE = `${JSCRAMBLER_TEMP_FOLDER}/protectionId`;
const JSCRAMBLER_BEG_ANNOTATION = '"JSCRAMBLER-BEG";';
const JSCRAMBLER_END_ANNOTATION = '"JSCRAMBLER-END";';
const JSCRAMBLER_EXTS = /.(j|t)s(x)?$/i;

/**
 * Only 'bundle' command triggers obfuscation
 * @returns {string} skip reason. If falsy value dont skip obfuscation
 */
function skipObfuscation() {
  let isBundleCmd = false;
  const command = new Command();
  command
    .command(BUNDLE_CMD)
    .allowUnknownOption()
    .action(() => (isBundleCmd = true));
  command.option(`${BUNDLE_DEV_CLI_ARG} <boolean>`).parse(process.argv);
  if (!isBundleCmd) {
    return 'Not a *bundle* command';
  }
  if (command.dev === 'true') {
    return (
      process.env.JSCRAMBLER_METRO_DEV !== 'true' &&
      'Development mode. Override with JSCRAMBLER_METRO_DEV=true environment variable'
    );
  }
  return null;
}

function getBundlePath() {
  const command = new Command();
  command
    .option(`${BUNDLE_OUTPUT_CLI_ARG} <string>`)
    .option(`${BUNDLE_SOURCEMAP_OUTPUT_CLI_ARG} <string>`)
    .parse(process.argv);
  if (command.bundleOutput) {
    return {
      bundlePath: command.bundleOutput,
      bundleSourceMapPath: command.sourcemapOutput
    };
  }
  console.error('Bundle output path not found.');
  return process.exit(-1);
}

function buildNormalizePath(path, projectRoot) {
  const relativePath = path.replace(projectRoot, '');
  return relativePath.replace(JSCRAMBLER_EXTS, '.js');
}

function obfuscateBundle(
  {bundlePath, bundleSourceMapPath},
  fileNames,
  sourceMapFiles,
  config,
  projectRoot
) {
  let userFiles;
  let filesWithMycode;
  let protectionId;

  return Promise.all([
    emptyDir(JSCRAMBLER_SRC_TEMP_FOLDER),
    emptyDir(JSCRAMBLER_DIST_TEMP_FOLDER),
    remove(JSCRAMBLER_PROTECTION_ID_FILE)
  ])
    .then(() => readFile(bundlePath, 'utf8'))
    .then(bundleCode => {
      filesWithMycode = bundleCode.split(JSCRAMBLER_BEG_ANNOTATION);

      userFiles = filesWithMycode
        .filter((c, i) => i > 0)
        .map(c => c.split(JSCRAMBLER_END_ANNOTATION)[0]);
      return userFiles;
    })
    .then(() =>
      Promise.all(
        fileNames.map(n =>
          mkdirp(path.join(JSCRAMBLER_SRC_TEMP_FOLDER, path.dirname(n)))
        )
      )
    )
    .then(() =>
      Promise.all(
        userFiles.map((c, i) =>
          writeFile(`${JSCRAMBLER_SRC_TEMP_FOLDER}${fileNames[i]}`, c)
        )
      )
    )
    .then(() =>
      Promise.all(
        sourceMapFiles.map(({filename, content}) =>
          writeFile(`${JSCRAMBLER_SRC_TEMP_FOLDER}${filename}`, content)
        )
      )
    )
    .then(() => {
      config.filesSrc = [`${JSCRAMBLER_SRC_TEMP_FOLDER}/**/*.js?(.map)`];
      config.filesDest = JSCRAMBLER_DIST_TEMP_FOLDER;
      config.cwd = JSCRAMBLER_SRC_TEMP_FOLDER;
      config.clientId = JSCRAMBLER_CLIENT_ID;

      const jscramblerOp = config.instrument
        ? jscrambler.instrumentAndDownload
        : jscrambler.protectAndDownload;

      return jscramblerOp.call(jscrambler, config);
    })
    .then(_protectionId =>
      writeFile(JSCRAMBLER_PROTECTION_ID_FILE, (protectionId = _protectionId))
    )
    .then(
      () =>
        config.sourceMaps &&
        bundleSourceMapPath &&
        jscrambler.downloadSourceMaps(Object.assign({protectionId}, config))
    )
    .then(() =>
      Promise.all([
        Promise.all(
          userFiles.map((c, i) =>
            readFile(`${JSCRAMBLER_DIST_TEMP_FOLDER}${fileNames[i]}`, 'utf8')
          )
        ),
        config.sourceMaps && bundleSourceMapPath
          ? Promise.all(
              userFiles.map((c, i) =>
                readFile(
                  `${JSCRAMBLER_DIST_TEMP_FOLDER}/jscramblerSourceMaps/${fileNames[i]}.map`,
                  'utf8'
                )
              )
            )
          : Promise.resolve(),
        config.sourceMaps && bundleSourceMapPath
          ? readFile(bundleSourceMapPath, 'utf8')
          : Promise.resolve()
      ])
    )
    .then(([userFilesStr, userSourceMapsFiles, bundleSourceMap]) => {
      const sourceMapConsumersJscrambler = {};
      let sourceMapGenerator;
      const bundleFirstLinesFor = {};
      const bundleCode = filesWithMycode
        .map((c, i) => {
          if (i === 0) {
            return c;
          }

          const code = userFilesStr[i - 1];

          if (userSourceMapsFiles && bundleSourceMap) {
            sourceMapConsumersJscrambler[
              fileNames[i - 1]
            ] = new sourceMap.SourceMapConsumer(userSourceMapsFiles[i - 1]);
          }

          const tillCodeEnd = c.substr(
            c.indexOf(JSCRAMBLER_END_ANNOTATION) +
              JSCRAMBLER_END_ANNOTATION.length,
            c.length
          );
          return JSCRAMBLER_BEG_ANNOTATION + code + tillCodeEnd;
        })
        .join('');

      return new Promise(res => {
        if (userSourceMapsFiles && bundleSourceMap) {
          const bundleCodeAsStream = new Readable({
            read() {
              this.push(this.sent ? null : bundleCode);
              this.sent = true;
            }
          });

          let lines = 0;
          let filesRead = 0;
          readline
            .createInterface({
              input: bundleCodeAsStream
            })
            .on('line', line => {
              lines++;
              if (line.indexOf(JSCRAMBLER_BEG_ANNOTATION) !== -1) {
                bundleFirstLinesFor[fileNames[filesRead++]] = lines;
              }
            })
            .on('close', () => {
              console.log({bundleFirstLinesFor});
              console.log('info Jscrambler Source Maps');
              const sourceMapConsumer = new sourceMap.SourceMapConsumer(
                bundleSourceMap
              );
              sourceMapGenerator = new sourceMap.SourceMapGenerator({
                file: bundlePath
              });

              sourceMapConsumer.sources.forEach(function(sourceFile) {
                sourceMapGenerator._sources.add(sourceFile);
                const sourceContent = sourceMapConsumer.sourceContentFor(
                  sourceFile
                );
                if (sourceContent != null) {
                  sourceMapGenerator.setSourceContent(
                    sourceFile,
                    sourceContent
                  );
                }
              });

              sourceMapConsumer.eachMapping(mapping => {
                console.log('mapping.source', mapping.source);
                const normalizePath = buildNormalizePath(
                  mapping.source,
                  projectRoot
                );
                if (fileNames.indexOf(normalizePath) === -1) {
                  sourceMapGenerator.addMapping({
                    original: {
                      line: mapping.originalLine,
                      column: mapping.originalColumn
                    },
                    generated: {
                      line: mapping.generatedLine,
                      column: mapping.generatedColumn
                    },
                    source: mapping.source,
                    name: mapping.name
                  });
                } else {
                  const sourceMapJscrambler =
                    sourceMapConsumersJscrambler[normalizePath];
                  const generatedPositions = sourceMapJscrambler.allGeneratedPositionsFor(
                    {
                      line: mapping.originalLine,
                      column: mapping.originalColumn,
                      source: normalizePath
                    }
                  );
                  generatedPositions.forEach(({line, column}) => {
                    sourceMapGenerator.addMapping({
                      original: {
                        line: mapping.originalLine,
                        column: mapping.originalColumn
                      },
                      generated: {
                        line: line + bundleFirstLinesFor[normalizePath],
                        column
                      },
                      source: mapping.source,
                      name: mapping.name
                    });
                  });
                }
              });
            });
        } else {
          res({bundleCode, sourceMapGenerator});
        }
      });
    })
    .then(({bundleCode, sourceMapGenerator}) =>
      Promise.all([
        writeFile(
          bundlePath,
          bundleCode.replace(new RegExp(JSCRAMBLER_BEG_ANNOTATION, 'g'), '')
        ),
        sourceMapGenerator &&
          writeFile(`${bundleSourceMapPath}`, sourceMapGenerator.toString())
      ])
    );
}

function wrapCodeWithTags(data, startTag, endTag) {
  const startIndex = data.code.indexOf('{');
  const endIndex = data.code.lastIndexOf('}');
  const init = data.code.substring(0, startIndex + 1);
  const clientCode = data.code.substring(startIndex + 1, endIndex);
  const end = data.code.substr(endIndex, data.code.length);
  data.code = init + startTag + clientCode + endTag + end;
}

/**
 * Use 'metro-source-map' to build a standard source-map from raw mappings
 * @param {{code: string, map: Array.<Array<number>>}} output
 * @param {string} modulePath
 * @param {string} source
 * @returns {string}
 */
function buildModuleSourceMap(output, modulePath, source) {
  return metroSourceMap
    .fromRawMappings([
      {
        ...output,
        source,
        path: modulePath
      }
    ])
    .toString(modulePath);
}

module.exports = function(_config = {}, projectRoot = process.cwd()) {
  const skipReason = skipObfuscation();
  if (skipReason) {
    console.log(`warning: Jscrambler Obfuscation SKIPPED [${skipReason}]`);
    return {};
  }
  const bundlePath = getBundlePath();
  const fileNames = new Set();
  const sourceMapFiles = [];
  const config = Object.assign({}, jscrambler.config, _config);

  const sourceMaps = !!config.sourceMaps;
  const instrument = !!config.instrument;

  process.on('beforeExit', function(exitCode) {
    console.log(
      instrument
        ? 'info Jscrambler Instrumenting Code'
        : 'info Jscrambler Obfuscating Code'
    );
    obfuscateBundle(
      bundlePath,
      Array.from(fileNames),
      sourceMapFiles,
      config,
      projectRoot
    )
      .catch(err => {
        console.error(err);
        process.exit(1);
      })
      .finally(() => process.exit(exitCode));
  });

  return {
    serializer: {
      processModuleFilter(_module) {
        if (
          _module.path.indexOf('node_modules') !== -1 ||
          typeof _module.path !== 'string' ||
          !fs.existsSync(_module.path) ||
          !path.extname(_module.path).match(JSCRAMBLER_EXTS)
        ) {
          return true;
        }

        const normalizePath = buildNormalizePath(_module.path, projectRoot);
        fileNames.add(normalizePath);
        _module.output.forEach(({data}) => {
          if ((instrument || sourceMaps) && Array.isArray(data.map)) {
            sourceMapFiles.push({
              filename: `${normalizePath}.map`,
              content: buildModuleSourceMap(
                data,
                _module.path.replace(projectRoot, ''),
                _module.getSource().toString()
              )
            });
          }
          wrapCodeWithTags(
            data,
            JSCRAMBLER_BEG_ANNOTATION,
            JSCRAMBLER_END_ANNOTATION
          );
        });
        return true;
      }
    }
  };
};
