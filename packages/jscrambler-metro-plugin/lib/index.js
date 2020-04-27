const {emptyDir, copy, mkdirp, readFile, writeFile} = require('fs-extra');
const {createReadStream} = require('fs');
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

/**
 * Extract stings from readable stream and count lines based on start/end Tag
 * @param {string} inputStr
 * @param {string} startTag
 * @param {string} endTag
 * @returns {Promise<unknown>}
 */
function extractLocs(inputStr, {startTag, endTag}) {
  let locs = [];
  let lines = 0;
  return new Promise((res, rej) =>
    readline.createInterface({
      input: new Readable({
        read() {
          this.push(this.sent ? null : inputStr);
          this.sent = true;
        }
      }),
      crlfDelay: Infinity,
      terminal: false,
      historySize: 0
    })
      .on('line', line => {
        lines++;
        const startTagIndex = line.indexOf(startTag);
        if (startTagIndex !== -1) {
          locs.push({
            lineStart: lines,
            columnStart: startTagIndex
          });
        }

        if (line.indexOf(endTag) !== -1) {
          locs[locs.length - 1].lineEnd = lines;
        }
      })
      .on('close', () => res(locs))
      .on('error', rej)
  )
}

function stripJscramblerTags(code) {
  return code.replace(new RegExp(JSCRAMBLER_BEG_ANNOTATION, 'g'), '')
    .replace(new RegExp(JSCRAMBLER_END_ANNOTATION, 'g'), '')
}

async function obfuscateBundle(
  {bundlePath, bundleSourceMapPath},
  fileNames,
  sourceMapFiles,
  config,
  projectRoot
) {
  await emptyDir(JSCRAMBLER_TEMP_FOLDER);

  const metroBundle = await readFile(bundlePath, 'utf8');

  let metroBundleLocs = await extractLocs(metroBundle, {
    startTag: JSCRAMBLER_BEG_ANNOTATION,
    endTag: JSCRAMBLER_END_ANNOTATION
  });

  // split by jscrambler tags
  const metroBundleChunks = metroBundle.split(JSCRAMBLER_BEG_ANNOTATION);

  // extract user code only (ignore vendor)
  const originalUserFiles = metroBundleChunks
    .filter((c, i) => i > 0)
    .map((c, i) => {
      return c.split(JSCRAMBLER_END_ANNOTATION)[0];
    });

  // build src folder structure
  await Promise.all(
    fileNames.map(n =>
      mkdirp(path.join(JSCRAMBLER_SRC_TEMP_FOLDER, '/', path.dirname(n)))
    )
  )

  // write user files to tmp folder
  await Promise.all(
    originalUserFiles.map((c, i) =>
      writeFile(`${JSCRAMBLER_SRC_TEMP_FOLDER}/${fileNames[i]}`, c)
    )
  )

  Promise.all(
    sourceMapFiles.map(({filename, content}) =>
      writeFile(`${JSCRAMBLER_SRC_TEMP_FOLDER}/${filename}`, content)
    )
  )

  // adapt configs for react-native
  config.filesSrc = [`${JSCRAMBLER_SRC_TEMP_FOLDER}/**/*.js?(.map)`];
  config.filesDest = JSCRAMBLER_DIST_TEMP_FOLDER;
  config.cwd = JSCRAMBLER_SRC_TEMP_FOLDER;
  config.clientId = JSCRAMBLER_CLIENT_ID;

  const jscramblerOp = !!config.instrument
    ? jscrambler.instrumentAndDownload
    : jscrambler.protectAndDownload;

  // obfuscate or instrument
  const protectionId = await jscramblerOp.call(jscrambler, config);

  // store protection id
  await writeFile(JSCRAMBLER_PROTECTION_ID_FILE, protectionId);

  // read obfuscated user files
  const obfusctedUserFiles = await Promise.all(originalUserFiles.map((c, i) =>
    readFile(`${JSCRAMBLER_DIST_TEMP_FOLDER}/${fileNames[i]}`, 'utf8')
  ));

  // join code in one single bundle
  const finalBundle = metroBundleChunks.reduce((acc, c, i) => {
    if (i === 0) {
      return c;
    }

    const obfuscatedCode = obfusctedUserFiles[i - 1];
    const tillCodeEnd = c.substr(
      c.indexOf(JSCRAMBLER_END_ANNOTATION),
      c.length
    );
    return acc + JSCRAMBLER_BEG_ANNOTATION + obfuscatedCode + tillCodeEnd;
  }, '');

  const finalBundleWithoutTags = stripJscramblerTags(finalBundle);
  await copy(bundlePath, bundlePath + ".bkp");
  await writeFile(bundlePath, finalBundleWithoutTags);

  if (config.sourceMaps && bundleSourceMapPath) {
    console.log('info Jscrambler Source Maps');

    // download sourcemaps
    await jscrambler.downloadSourceMaps(Object.assign({protectionId}, config));

    // read obfuscated source-map from filesystem
    const obfuscatedSourceMaps = await Promise.all(originalUserFiles.map((c, i) =>
      readFile(`${JSCRAMBLER_DIST_TEMP_FOLDER}/jscramblerSourceMaps/${fileNames[i]}.map`, 'utf8')
    ));

    // read metro source-map
    const metroSourceMap = await readFile(bundleSourceMapPath, 'utf8');

    const finalBundleLocs = await extractLocs(finalBundle, {
      startTag: JSCRAMBLER_BEG_ANNOTATION,
      endTag: JSCRAMBLER_END_ANNOTATION
    });

    // console.log({metroBundleLocs});
    // console.log({finalBundleLocs});
    // console.log('obfuscatedSourceMaps', obfuscatedSourceMaps.length);
    // console.log('metroSourceMap', metroSourceMap.length);
    // console.log({fileNames})

    const metroSourceMapConsumer = new sourceMap.SourceMapConsumer(metroSourceMap);
    const finalSourceMapGenerator = new sourceMap.SourceMapGenerator({file: bundlePath});
    const ofuscatedSourceMapConsumers = obfuscatedSourceMaps.map(map => new sourceMap.SourceMapConsumer(map));

    // add all original sources and sourceContents
    metroSourceMapConsumer.sources.forEach(function (sourceFile) {
      finalSourceMapGenerator._sources.add(sourceFile)
      var sourceContent = metroSourceMapConsumer.sourceContentFor(sourceFile);
      if (sourceContent != null) {
        finalSourceMapGenerator.setSourceContent(sourceFile, sourceContent)
      }
    });

    let shiftLines = 0;
    let tmpShiftLine = 0;
    let currSource;
    metroSourceMapConsumer.eachMapping(mapping => {
      const newMapping = {
        original: mapping.originalLine ? {line: mapping.originalLine, column: mapping.originalColumn} : null,
        source: mapping.source,
        name: mapping.name,
        generated: {
          line: mapping.generatedLine,
          column: mapping.generatedColumn
        }
      }
      const normalizePath = buildNormalizePath(mapping.source, projectRoot);
      const fileNamesIndex = fileNames.indexOf(normalizePath);

      if (currSource !== normalizePath) {
        currSource = normalizePath;
        shiftLines = tmpShiftLine;
      }

      if (fileNamesIndex !== -1) {
        const {lineStart, lineEnd, columnStart} = metroBundleLocs[fileNamesIndex];

        const {lineStart: finalLineStart, lineEnd: finalLineEnd, columnStart: finalColumnStart} = finalBundleLocs[fileNamesIndex];

        /*let {line: obfLine, column: obfColumn} = ofuscatedSourceMapConsumers[fileNamesIndex].generatedPositionFor({
          source: normalizePath,
          line: newMapping.generated.line - lineStart + 1,
          column: newMapping.generated.column - columnStart
        });*/

        const allGenPos = ofuscatedSourceMapConsumers[fileNamesIndex].allGeneratedPositionsFor({
            source: normalizePath,
            line: newMapping.generated.line - lineStart + 1,
            column: newMapping.generated.column - columnStart
        });
        if(allGenPos.length === 0) {
          return;
        }
        obfLine = allGenPos[0].line;
        obfColumn = allGenPos[0].column;

        const calLine = finalLineStart + obfLine - 1;
        const calColumn = columnStart + obfColumn;
        const bkp = {...newMapping.generated};
        newMapping.generated.line = calLine;
        newMapping.generated.column = obfLine === 1 ? calColumn : obfColumn;
        //console.log('orig', bkp, '->', 'final', newMapping.generated, 'shiftLines', shiftLines, 'obf', {obfLine, obfColumn});
        tmpShiftLine = finalLineEnd - lineEnd;
      } else {
        newMapping.generated.line += shiftLines;
      }
      finalSourceMapGenerator.addMapping(newMapping);
    })

    await copy(bundleSourceMapPath, bundleSourceMapPath + "bkp");
    await writeFile(bundleSourceMapPath, finalSourceMapGenerator.toString());
  }
}

function wrapCodeWithTags(data, startTag, endTag) {
  let startIndex = data.code.indexOf('{');
  const endIndex = data.code.lastIndexOf('}');
  // keep new line in metro boilerplate
  if (data.code[startIndex + 1] === '\n') {
    startIndex++;
  }
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

function buildNormalizePath(path, projectRoot) {
  if (typeof path !== 'string' || path.trim().length === 0) {
    return;
  }
  const relativePath = path.replace(projectRoot, '');
  return relativePath.replace(JSCRAMBLER_EXTS, '.js').substring(1);
}

module.exports = function (_config = {}, projectRoot = process.cwd()) {
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

  process.on('beforeExit', function (exitCode) {
    console.log(
      instrument
        ? 'info Jscrambler Instrumenting Code'
        : 'info Jscrambler Obfuscating Code'
    );
    obfuscateBundle(bundlePath, Array.from(fileNames), sourceMapFiles, config, projectRoot)
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
          if ((instrument) && Array.isArray(data.map)) {
            sourceMapFiles.push({
              filename: `${normalizePath}.map`,
              content: buildModuleSourceMap(
                data,
                normalizePath,
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
