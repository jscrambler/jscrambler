const {emptyDir, remove, mkdirp, readFile, writeFile} = require('fs-extra');
const jscrambler = require('jscrambler').default;
const commander = require('commander');
const fs = require('fs');
const path = require('path');
const metroSourceMap = require('metro-source-map');

const BUNDLE_OUTPUT_CLI_ARG = '--bundle-output';

const JSCRAMBLER_CLIENT_ID = 6;
const JSCRAMBLER_TEMP_FOLDER = '.jscrambler';
const JSCRAMBLER_DIST_TEMP_FOLDER = `${JSCRAMBLER_TEMP_FOLDER}/dist/`;
const JSCRAMBLER_SRC_TEMP_FOLDER = `${JSCRAMBLER_TEMP_FOLDER}/src`;
const JSCRAMBLER_PROTECTION_ID_FILE = `${JSCRAMBLER_TEMP_FOLDER}/protectionId`;
const JSCRAMBLER_BEG_ANNOTATION = '"JSCRAMBLER-BEG";';
const JSCRAMBLER_END_ANNOTATION = '"JSCRAMBLER-END";';
const JSCRAMBLER_EXTS = /.(j|t)s(x)?$/i;

function getBundlePath() {
  commander.option(`${BUNDLE_OUTPUT_CLI_ARG} <string>`).parse(process.argv);
  if (commander.bundleOutput) {
    return commander.bundleOutput;
  }
  console.error('Bundle output path not found.');
  return process.exit(-1);
}

function obfuscateBundle(bundlePath, fileNames, sourceMapFiles, config) {
  let userFiles;
  let filesWithMycode;

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
    .then(userFilesStr =>
      filesWithMycode.map((c, i) => {
        if (i === 0) {
          return c;
        }

        const code = userFilesStr[i - 1];

        const tillCodeEnd = c.substr(
          c.indexOf(JSCRAMBLER_END_ANNOTATION) +
            JSCRAMBLER_END_ANNOTATION.length,
          c.length
        );
        return code + tillCodeEnd;
      })
    )
    .then(bundleList => writeFile(bundlePath, bundleList.join('')));
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
  const bundlePath = getBundlePath();
  const fileNames = new Set();
  const sourceMapFiles = [];
  const config = Object.assign({}, jscrambler.config, _config);

  const sourceMaps = !!config.sourceMaps;
  const instrument = !!config.instrument;

  process.on('beforeExit', function(exitCode) {
    console.log('Obfuscating code');
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
