const client = require('jscrambler').default;
const {SourceMapSource} = require('webpack-sources');

const sourceMaps = !!client.config.sourceMaps;

class JscramblerPlugin {
  constructor(_options) {
    let options = _options;
    if (typeof options !== 'object' || Array.isArray(options)) options = {};
    this.options = options;

    this.processResult = this.processResult.bind(this);
    this.processSourceMaps = this.processSourceMaps.bind(this);
  }

  apply(compiler) {
    const enable =
      this.options.enable !== undefined ? this.options.enable : true;

    if (!enable) {
      return;
    }

    compiler.plugin('emit', (compilation, callback) => {
      const sources = [];
      compilation.chunks.forEach(chunk => {
        if (
          Array.isArray(this.options.chunks) &&
          !this.options.chunks.includes(chunk.name)
        ) {
          return;
        }

        chunk.files.forEach(filename => {
          if (/\.(js|html|htm)$/.test(filename)) {
            const content = compilation.assets[filename].source();

            sources.push({content, filename});
          }

          if (sourceMaps && /\.(js.map)$/.test(filename)) {
            const sourceMapContent = compilation.assets[filename].source();
            if (sourceMapContent) {
              sources.push({
                content: sourceMapContent,
                filename
              });
            }
          }
        });
      });

      if (sources.length > 0) {
        Promise.resolve(
          client.protectAndDownload(
            Object.assign(this.options, {
              sources,
              stream: false
            }),
            res => {
              this.protectionResult = res;
            }
          )
        )
          .then(protectionId =>
            this.processResult(protectionId, compilation, callback)
          )
          .catch(err => {
            throw err;
          });
      } else {
        callback();
      }
    });
  }

  processSourceMaps(results, compilation, callback) {
    for (const result of results) {
      const sourceFilename = result.filename
        .slice(0, -4)
        .replace('jscramblerSourceMaps/', '');
      compilation.warnings.push(`Processing sourcemap: ${sourceFilename}`);

      const sm = JSON.parse(result.content);

      if (compilation.assets[sourceFilename]) {
        compilation.assets[`${sourceFilename}.map`] = {
          source() {
            return result.content;
          },
          size() {
            return result.content.length;
          }
        };

        const content = compilation.assets[sourceFilename].source();
        compilation.assets[sourceFilename] = new SourceMapSource(
          content,
          sourceFilename,
          sm
        );
      }
    }

    callback();
  }

  processResult(protectionId, compilation, callback) {
    const results = this.protectionResult;

    for (const result of results) {
      compilation.assets[result.filename] = {
        source() {
          return result.content;
        },
        size() {
          return result.content.length;
        }
      };
    }

    if (sourceMaps) {
      client.downloadSourceMaps(
        Object.assign({}, client.config, {stream: false, protectionId}),
        res => this.processSourceMaps(res, compilation, callback)
      );

      return;
    }

    callback();
  }
}

module.exports = JscramblerPlugin;
