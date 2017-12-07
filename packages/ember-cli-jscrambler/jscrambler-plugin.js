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
    jscrambler: {}
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

JscramblerWriter.prototype.build = function() {
  const sources = this.inputPaths.reduce((res, inputPath) => {
    walkSync(inputPath).forEach(filename => {
      if (filename.slice(-1) === '/') {
        return;
      }

      const inFile = path.join(inputPath, filename);
      const outFile = path.join(this.outputPath, filename);

      ensureDir(outFile);

      const content = fs.readFileSync(path.join(inputPath, filename), 'utf8');

      if (filename.slice(-3) === '.js' && !this.excludes.match(filename)) {
        res.push({content, filename});
      } else {
        symlinkOrCopy.sync(inFile, outFile);
      }
    });

    return res;
  }, []);

  return jscrambler
    .protectAndDownload(
      Object.assign({}, this.options.jscrambler, {
        sources,
        stream: false
      }),
      outputFiles => {
        outputFiles.forEach(file => {
          fs.writeFileSync(
            path.join(this.outputPath, file.filename),
            file.content
          );
        });

        return this.outputPath;
      }
    )
    .then(() => this.outputPath);
};

JscramblerWriter.prototype.constructor = JscramblerWriter;

module.exports = JscramblerWriter;
