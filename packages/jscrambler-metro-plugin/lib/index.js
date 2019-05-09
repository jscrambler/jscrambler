const fs = require('fs');
const jscrambler = require('jscrambler').default;
const promisify = require('util').promisify;
const path = require('path');

const mkdirPromise = promisify(fs.mkdir);
const readFilePromise = promisify(fs.readFile);
const copyFilePromise = promisify(fs.copyFile);

function obfuscateBundle(bundlePath) {
  return mkdirPromise('jscrambler').catch(() => {/*ignore*/})
    .then(() => mkdirPromise('jscrambler/dist').catch(() => {/*ignore*/}))
    .then(() => copyFilePromise(bundlePath, 'jscrambler/code.js'))
    .then(() => readFilePromise('.jscramblerrc', { encoding: 'utf8' }))
    .then(out => JSON.parse(out))
    .then(configResult => {
      configResult.filesSrc = ['jscrambler/code.js'];
      configResult.filesDest = 'jscrambler/dist/';
      return jscrambler.protectAndDownload(configResult);
    }).then(() => copyFilePromise('jscrambler/dist/jscrambler/code.js', bundlePath));
}

module.exports.getDummyMinifierPath = function() {
  return path.join(__dirname, 'dummy-minification');
};

module.exports.install = function() {
  let bundlePath;
  for (let i = 0; i < process.argv.length; i++) {
    if (process.argv[i] === '--bundle-output') {
      bundlePath = process.argv[i + 1];
      break;
    }
  }
  if (!bundlePath) {
    console.error('Missing --bundle-output option');
    return;
  }

  process.on('beforeExit', function(exitCode) {
    console.log('Obfuscating code');
    obfuscateBundle(bundlePath).catch(err => {
      console.error(err);
      process.exit(1);
    }).finally(() => process.exit(exitCode));
  });
};

