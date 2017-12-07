const client = require('jscrambler').default;

class JscramblerPlugin {
  constructor (_options) {
    let options = _options;
    if (typeof options !== 'object' || Array.isArray(options)) options = {};
    this.options = options;

    this.processResult = this.processResult.bind(this);
  }

  apply (compiler) {
    const enable = this.options.enable !== undefined ? this.options.enable : true;

    if (!enable) {
      return;
    }

    compiler.plugin('emit', (compilation, callback) => {
      const sources = [];
      compilation.chunks.forEach((chunk) => {
        if (Array.isArray(this.options.chunks) && !this.options.chunks.includes(chunk.name)) {
          return;
        }

        chunk.files.forEach((filename) => {
          if (/\.(js|map|html|htm)$/.test(filename)) {
            const content = compilation.assets[filename].source();

            sources.push({content, filename});
          }
        });
      });

      if (sources.length > 0) {
        Promise.resolve(
          client.protectAndDownload(Object.assign(
            this.options,
            {
              sources,
              stream: false
            }
          ), res => this.processResult(res, compilation, callback))
        )
        .catch((err) => {
          callback(`Jscrambler ${err}`);
        });
      } else {
        callback();
      }
    });
  }

  processResult (results, compilation, callback) {
    for (const result of results) {
      compilation.assets[result.filename] = {
        source () {
          return result.content;
        },
        size () {
          return result.content.length;
        }
      };
    }
    callback();
  }
}

module.exports = JscramblerPlugin;
