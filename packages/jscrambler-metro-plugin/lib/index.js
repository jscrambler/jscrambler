const {emptyDir, mkdirp, readFile, writeFile} = require('fs-extra');
const jscrambler = require('jscrambler').default;
const commander = require('commander');
const fs = require('fs');
const path = require('path');

const BUNDLE_OUTPUT_CLI_ARG = '--bundle-output';

const JSCRAMBLER_TEMP_FOLDER = '.jscrambler';
const JSCRAMBLER_DIST_TEMP_FOLDER = `${JSCRAMBLER_TEMP_FOLDER}/dist/`;
const JSCRAMBLER_SRC_TEMP_FOLDER = `${JSCRAMBLER_TEMP_FOLDER}/src`;
const JSCRAMBLER_BEG_ANNOTATION = '"JSCRAMBLER-BEG";';
const JSCRAMBLER_END_ANNOTATION = '"JSCRAMBLER-END";';
const JSCRAMBLER_EXTS = ['.js', '.jsx'];

function getBundlePath() {
  commander.option(`${BUNDLE_OUTPUT_CLI_ARG} <string>`).parse(process.argv);
  if (commander.bundleOutput) {
    return commander.bundleOutput;
  }
  console.error('Bundle output path not found.');
  return process.exit(-1);
}

function obfuscateBundle(bundlePath, fileNames, config) {
  let userFiles;
  let filesWithMycode;

  return Promise.all([
    emptyDir(JSCRAMBLER_SRC_TEMP_FOLDER),
    emptyDir(JSCRAMBLER_DIST_TEMP_FOLDER)
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
    .then(() => {
      config.filesSrc = [`${JSCRAMBLER_SRC_TEMP_FOLDER}/**/*.js`];
      config.filesDest = JSCRAMBLER_DIST_TEMP_FOLDER;
      config.cwd = JSCRAMBLER_SRC_TEMP_FOLDER;
      return jscrambler.protectAndDownload(config);
    })
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

module.exports = function(config = {}, projectRoot = process.cwd()) {
  const bundlePath = getBundlePath();
  const fileNames = new Set();

  process.on('beforeExit', function(exitCode) {
    console.log('Obfuscating code');
    obfuscateBundle(bundlePath, Array.from(fileNames), config)
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
          !JSCRAMBLER_EXTS.includes(path.extname(_module.path))
        ) {
          return true;
        }

        fileNames.add(_module.path.replace(projectRoot, ''));
        _module.output.forEach(({data}) =>
          wrapCodeWithTags(
            data,
            JSCRAMBLER_BEG_ANNOTATION,
            JSCRAMBLER_END_ANNOTATION
          )
        );
        return true;
      }
    }
  };
};
