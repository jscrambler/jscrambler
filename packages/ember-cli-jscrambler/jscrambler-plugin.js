const jscrambler = require('jscrambler').default;
const Plugin = require('broccoli-plugin');
const defaults = require('lodash.defaultsdeep');
const memoize = require('lodash.memoize');
const walkSync = require('walk-sync');
const path = require('path');
const fs = require('fs');
const mkdirp = require('mkdirp');
const symlinkOrCopy = require('symlink-or-copy');
const MatcherCollection = require('matcher-collection');

const silent = process.argv.indexOf('--silent') !== -1;

const instrument = !!jscrambler.config.instrument;
const jscramblerOp = instrument
  ? jscrambler.instrumentAndDownload
  : jscrambler.protectAndDownload;

const ensureDir = memoize(filename => {
  const p = path.dirname(filename);
  mkdirp.sync(p);

  return p;
});

const MatchNothing = {
  match() {
    return false;
  }
};

function JscramblerWriter(inputNodes, options) {
  if (!(this instanceof JscramblerWriter)) {
    return new JscramblerWriter(inputNodes, options);
  }

  inputNodes = Array.isArray(inputNodes) ? inputNodes : [inputNodes];

  Plugin.call(this, inputNodes, options);

  this.options = defaults(options, {
    jscrambler: {},
    sourcemaps: false
  });

  this.inputNodes = inputNodes;

  const exclude = this.options.exclude;
  if (Array.isArray(exclude)) {
    this.excludes = new MatcherCollection(exclude);
  } else {
    this.excludes = MatchNothing;
  }
}

JscramblerWriter.prototype = Object.create(Plugin.prototype);

JscramblerWriter.prototype.processFile = function(inFile, outFile, filename) {
  const src = fs.readFileSync(inFile, 'utf-8');
  const mapName = path.basename(outFile).replace(/\.js$/,'') + '.map';

  const source = {filename, content: src }

  if (this.options.sourcemaps) {
    let sourceMapPath = inFile.slice(0, -3) + '.map';
    if (fs.existsSync(sourceMapPath)) {
      const sourceMapContent = fs.readFileSync(sourceMapPath);

      const sourceMap = {
        filename: filename + '.map',
        content: sourceMapContent
      };

      return [source, sourceMap];
    }
  }

  return [source];
};

JscramblerWriter.prototype.build = function() {
  const sources = this.inputPaths.reduce((res, inputPath) => {
    walkSync(inputPath).forEach(filename => {
      if (filename.slice(-1) === '/') {
        return;
      }

      const inFile = path.join(inputPath, filename);
      const outFile = path.join(this.outputPath, filename);

      ensureDir(outFile);

      if (filename.slice(-3) === '.js' && !this.excludes.match(filename)) {
        this.processFile(inFile, outFile, filename).forEach(f => {
          res.push(f);
        });
      } else if (filename.slice(-4) === '.map') {
        if (this.excludes.match(filename.slice(0, -4) + '.js')) {
          // ensure .map files for excldue JS paths are also copied forward
          symlinkOrCopy.sync(inFile, outFile);
        }
        // skip, because it will get handled when its corresponding JS does
      } else {
        symlinkOrCopy.sync(inFile, outFile);
      }
    });

    return res;
  }, []);

  const output = [];

  return jscramblerOp
    .call(
      jscrambler,
      Object.assign({}, this.options.jscrambler, {
        sources,
        stream: false,
        clientId: 5
      }),
      outputFiles => {
        outputFiles.forEach(file => {
          if (file.filename.slice(-4) !== '.map') {
            fs.writeFileSync(
              path.join(this.outputPath, file.filename),
              file.content
            );
          }
        });

        return this.outputPath;
      }
    )
    .then(protectionId => {
      if (this.options.sourcemaps && !instrument) {
        return new Promise((resolve, reject) =>
          jscrambler.downloadSourceMaps(
            Object.assign({}, jscrambler.config, {stream: false, protectionId}),
            (res, error) => {
              if (error) {
                console.error(error);
                return reject(error);
              }
              
              return this.processSourceMaps(res, this.outputPath, resolve);
            }
          ));
      }

      return this.outputPath;
    });
};

JscramblerWriter.prototype.processSourceMaps = function(results, outputPath, done) {
  for (const result of results) {
    const sourceFilename = result.filename
      .slice(0, -4)
      .replace('jscramblerSourceMaps/', '');

    let sourceMapName = sourceFilename.slice(0, -3) + '.map';

    fs.writeFileSync(
      path.join(outputPath, sourceMapName),
      result.content
    );
  }

  done(outputPath);
}

JscramblerWriter.prototype.constructor = JscramblerWriter;

module.exports = JscramblerWriter;
