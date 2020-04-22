const {emptyDir, remove, mkdirp, readFile, writeFile} = require('fs-extra');
const jscrambler = require('jscrambler').default;
const {Command} = require('commander');
const fs = require('fs');
const path = require('path');
const metroSourceMap = require('metro-source-map');
const MagicString = require('magic-string');
const mergeSourceMap = require('merge-source-map');

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

function obfuscateBundle(
  {bundlePath, bundleSourceMapPath},
  fileNames,
  sourceMapFiles,
  config
) {
  let userFiles;
  let filesWithMycode;
  let filesIndexes;
  let magicBundle;

  return Promise.all([
    emptyDir(JSCRAMBLER_SRC_TEMP_FOLDER),
    emptyDir(JSCRAMBLER_DIST_TEMP_FOLDER),
    remove(JSCRAMBLER_PROTECTION_ID_FILE)
  ])
    .then(() => readFile(bundlePath, 'utf8'))
    .then(bundleCode => {
      magicBundle = new MagicString(bundleCode);
      filesIndexes = [];
      /* BEG */
      let res;
      let regex1 = new RegExp(JSCRAMBLER_BEG_ANNOTATION, 'g');
      // eslint-disable-next-line no-cond-assign
      while ((res = regex1.exec(bundleCode)) !== null) {
        filesIndexes.push([res.index]);
      }

      /* END */
      regex1 = new RegExp(JSCRAMBLER_END_ANNOTATION, 'g');
      let pos = 0;
      // eslint-disable-next-line no-cond-assign
      while ((res = regex1.exec(bundleCode)) !== null) {
        filesIndexes[pos++].push(res.index);
      }

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

      const jscramblerOp = !!config.instrument
        ? jscrambler.instrumentAndDownload
        : jscrambler.protectAndDownload;

      return jscramblerOp.call(jscrambler, config);
    })
    .then(protectionId =>
      writeFile(JSCRAMBLER_PROTECTION_ID_FILE, protectionId)
    )
    .then(() =>
      Promise.all(
        userFiles.map((c, i) =>
          readFile(`${JSCRAMBLER_DIST_TEMP_FOLDER}${fileNames[i]}`, 'utf8')
        )
      )
    )
    .then(userFilesStr => {
      userFilesStr.forEach((c, i) => {
        magicBundle.overwrite(filesIndexes[i][0], filesIndexes[i][1], c);
      });
      return magicBundle.toString();
    })
    .then(bundleCode => writeFile(bundlePath, bundleCode))
    .then(
      () =>
        config.sourceMaps &&
        bundleSourceMapPath &&
        readFile(bundleSourceMapPath, 'utf8')
    )
    .then(bundleSourceMap => {
      if (
        typeof bundleSourceMap !== 'string' ||
        bundleSourceMap.trim().length === 0
      ) {
        return undefined;
      }
      console.log('info Jscrambler Source Maps');
      return mergeSourceMap(
        JSON.parse(bundleSourceMap),
        magicBundle.generateMap({hires: true})
      );
    })
    .then(
      mergedMap =>
        mergedMap && writeFile(bundleSourceMapPath, JSON.stringify(mergedMap))
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
    obfuscateBundle(bundlePath, Array.from(fileNames), sourceMapFiles, config)
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

        const relativePath = _module.path.replace(projectRoot, '');
        const normalizePath = relativePath.replace(JSCRAMBLER_EXTS, '.js');
        fileNames.add(normalizePath);
        _module.output.forEach(({data}) => {
          if ((instrument || sourceMaps) && Array.isArray(data.map)) {
            sourceMapFiles.push({
              filename: `${normalizePath}.map`,
              content: buildModuleSourceMap(
                data,
                relativePath,
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
