const {readFileSync} = require('fs');
const { ReplaceSource, RawSource } = require("webpack-sources");
const client = require('jscrambler').default;

const {
  JSCRAMBLER_CLIENT_ID,
  JSCRAMBLER_IGNORE
} = require('./constants');

const sourceMaps = !!client.config.sourceMaps;
const instrument = !!client.config.instrument;

class JscramblerNativeScriptWebpackPlugin {
  constructor(_config = {}, projectRoot = process.cwd()) {
    const config = Object.assign({}, client.config, _config);
    console.log('J-NS-W: Constructing...');
    this.config = Object.assign(config, {
      clientId: JSCRAMBLER_CLIENT_ID
    });

    this.instrument = instrument;
    if (typeof config.instrument === 'boolean') {
      this.instrument = config.instrument;
    }

    this.jscramblerOp = client.protectAndDownload;

    if (client.config.filesSrc || client.config.filesDest || config.filesSrc || config.filesDest) {
      console.warn('(JscramblerPlugin) Options *filesSrc* and *filesDest* were ignored. Webpack entry and output fields will be used instead!')
    }

    if (typeof this.config.ignoreFile === 'string') {
      if (basename(this.config.ignoreFile) !== JSCRAMBLER_IGNORE) {
        throw new Error('(JscramblerPlugin) *ignoreFile* option must point to .jscramblerignore file');
      }
      this.ignoreFileSource = {content: readFileSync(this.config.ignoreFile, { encoding: 'utf-8'}), filename: JSCRAMBLER_IGNORE};
    }
  }

  apply(compiler) {
    console.log('J-NS-W: Applying...');
    const enable =
      this.config.enable !== undefined ? this.config.enable : true;

    if (!enable) {
      return;
    }

    // TODO obfuscate bundle
    // const emitFn = compiler.hooks
    //   ? (arg) => compiler.hooks.emit.tapAsync("JscramblerNativescriptWebpackPlugin", arg)
    //   : (arg) => compiler.plugin("emit", arg); // compatibility with webpack <=3

    // compiler.hooks.emit.tapAsync("JscramblerNativescriptWebpackPlugin", (compilation, callback) => {
    //   compilation.chunks.forEach(chunk => {
    //     if (
    //       Array.isArray(this.config.chunks) &&
    //       !this.config.chunks.includes(chunk.name)
    //     ) {
    //       return;
    //     }

    //     chunk.files.forEach(filename => {
    //       const content = compilation.assets[filename].source();
    //       console.log({
    //         content
    //       });
    //     })
    //   });

    //   process.exit(1);
    // });

    compiler.hooks.compilation.tap("JscramblerNativescriptWebpackPlugin", compilation => {
      const sources = [];

      compilation.hooks.optimizeTree.tapAsync("JscramblerNativescriptWebpackPlugin", (chunks, modules, callback) => {
        chunks.forEach(chunk => {
          if (
            Array.isArray(this.config.chunks) &&
            !this.config.chunks.includes(chunk.name)
          ) {
            return;
          }

          chunk._modules.forEach(mod => {
            if (/\.(js|html|htm)$/.test(mod.rawRequest)) {
              const filename = mod.rawRequest.substring(2);
              const content = mod.originalSource().source();

              sources.push({content, filename});
            }
          })
        });

        if (sources.length > 0) {
          if (this.ignoreFileSource) {
            sources.push(this.ignoreFileSource);
          }
          Promise.resolve(
            this.jscramblerOp.call(
              client,
              Object.assign(this.config, {
                sources,
                stream: false
              }),
              res => {
                this.protectionResult = res.map(p => {
                  // normalize name. F.e. if the original names starts with "./", the protected version must also be set with "./" prefix
                  p.filename = (sources.find(({filename: oFilename}) => new RegExp(`^(./)*${p.filename}$`).test(oFilename)) ||  p).filename;
                  return p;
                });
              }
            )
          )
            .then(() =>
              this.processResult(modules, compilation, callback)
            )
            .catch(err => {
              callback(err);
            });
        }
      });
    });
  }

  processResult(modules, compilation, callback) {
    const results = this.protectionResult;

    for (const result of results) {
      if (result.filename === JSCRAMBLER_IGNORE) {
        continue;
      }

      const foundModule = modules.find(mod => mod.rawRequest && mod.rawRequest.substring(2) === result.filename);

      if (!foundModule) {
        throw new Error(`Could not find module ${result.filename}`);
      }

      const newSource = new RawSource(result.content);



      // console.log({
      //   before: foundModule.originalSource().source(),
      //   after: result.content
      // });

      // console.log({
      //   hmmmmm: foundModule._source
      // });

      // foundModule.originalSource().replace(0, foundModule.originalSource().size(), result.content)

      // foundModule._source = newSource;
    }

    callback();
  }

}

module.exports = JscramblerNativeScriptWebpackPlugin;
