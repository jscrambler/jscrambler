const {basename, normalize} = require('path');
const {readFileSync} = require('fs');
const assert = require('assert');
const astring = require('astring');
const esrecurse = require('esrecurse');
const acorn = require('acorn');
const client = require('jscrambler').default;
const {SourceMapSource} = require('webpack-sources');

const JSCRAMBLER_IGNORE = '.jscramblerignore';
const sourceMaps = !!client.config.sourceMaps;
const instrument = !!client.config.instrument;
const OBFUSCATION_LEVELS = {
  MODULE: 'module',
  BUNDLE: 'bundle'
}

class JscramblerPlugin {
  constructor(_options) {
    let options = _options;
    if (typeof options !== 'object' || Array.isArray(options)) options = {};

    this.options = Object.assign({
      excludeList: [],
      obfuscationLevel: OBFUSCATION_LEVELS.BUNDLE
    }, options, {
      clientId: 2,
    });

    if(![OBFUSCATION_LEVELS.BUNDLE, OBFUSCATION_LEVELS.MODULE].includes(this.options.obfuscationLevel)) {
      throw new Error(`Unknown obfuscation level ${this.options.obfuscationLevel}. Options: ${OBFUSCATION_LEVELS.BUNDLE} or ${OBFUSCATION_LEVELS.MODULE}`)
    }

    this.instrument = instrument;
    if (typeof options.instrument === 'boolean') {
      this.instrument = options.instrument;
    }

    this.jscramblerOp = this.instrument
      ? client.instrumentAndDownload
      : client.protectAndDownload;
    this.processResult = this.processResult.bind(this);
    this.processSourceMaps = this.processSourceMaps.bind(this);

    if (client.config.filesSrc || client.config.filesDest || options.filesSrc || options.filesDest) {
      console.warn('(JscramblerPlugin) Options *filesSrc* and *filesDest* were ignored. Webpack entry and output fields will be used instead!')
    }

    if (typeof this.options.ignoreFile === 'string') {
      if (basename(this.options.ignoreFile) !== JSCRAMBLER_IGNORE) {
        throw new Error('(JscramblerPlugin) *ignoreFile* option must point to .jscramblerignore file');
      }
      this.ignoreFileSource = {content: readFileSync(this.options.ignoreFile, { encoding: 'utf-8'}), filename: JSCRAMBLER_IGNORE};
    }

    if (this.options.obfuscationLevel === OBFUSCATION_LEVELS.MODULE) {
      if (sourceMaps) {
        throw new Error(`(JscramblerPlugin) obfuscationLevel=${this.options.obfuscationLevel} is not compatible with source maps generation.`)
      }
      if (!Array.isArray(this.options.chunks)) {
        throw new Error(`(JscramblerPlugin) when obfuscationLevel=${this.options.obfuscationLevel} you must specify the chunks list`);
      }
      console.log('(JscramblerPlugin) Obfuscation Level set to module')
    }
  }

  forEachModule(chunkName, contentOrTree, it) {
    const tree = typeof contentOrTree === 'string' ? acorn.parse(contentOrTree, {ecmaVersion: "latest"}) : contentOrTree;
    const options = this.options;
    esrecurse.visit(tree, {
      ObjectExpression(node) {
        for (const module of node.properties) {
          assert(module.key.type === 'Literal');
          assert(module.value.type === 'FunctionExpression');
          const moduleId = module.key.value.replace('../', '');
          const moduleFilename = normalize(`${chunkName}/${moduleId}.js`);
          const keep = it({moduleFilename, functionNode: module.value, moduleId, tree});
          if (keep === false) {
            break;
          }
        }
        return false;
      }
    });
  }

  apply(compiler) {
    const enable =
      this.options.enable !== undefined ? this.options.enable : true;

    if (!enable) {
      return;
    }

    const emitFn = compiler.hooks
      ? (arg) => compiler.hooks.emit.tapAsync("JscramblerPlugin", arg)
      : (arg) => compiler.plugin("emit", arg); // compatibility with webpack <=3

    emitFn((compilation, callback) => {
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

            if (this.options.obfuscationLevel === OBFUSCATION_LEVELS.BUNDLE) {
              sources.push({content, filename});
            } else if(this.options.obfuscationLevel === OBFUSCATION_LEVELS.MODULE) {
              this.forEachModule(filename, content, ({moduleFilename, functionNode, moduleId}) => {
                sources.push({
                  content: astring.generate(functionNode.body),
                  filename: moduleFilename
                });
                // add function arguments to exclude list
                if (Array.isArray(functionNode.params)) {
                  functionNode.params.filter(n => n.type === 'Identifier').forEach(n => {
                    if (!this.options.excludeList.includes(n.name)) {
                      this.options.excludeList.push(n.name)
                    }
                  })
                }
              })
            }
          }

          if ((this.instrument || sourceMaps) && /\.(js.map)$/.test(filename)) {
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
        if (this.ignoreFileSource) {
          sources.push(this.ignoreFileSource);
        }
        Promise.resolve(
          this.jscramblerOp.call(
            client,
            Object.assign(this.options, {
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
          .then(protectionId =>
            this.processResult(protectionId, compilation, callback)
          )
          .catch(err => {
            callback(err);
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
    const protectTreesOrCodeMap = new Map();

    for (const result of results) {
      if (result.filename === JSCRAMBLER_IGNORE) {
        continue;
      }

      if (this.options.obfuscationLevel === OBFUSCATION_LEVELS.BUNDLE) {
        protectTreesOrCodeMap.set(result.filename, result.content);
      } else if (this.options.obfuscationLevel === OBFUSCATION_LEVELS.MODULE) {
        const [chunkFileName] = result.filename.split('/');
        let found = false;
        this.forEachModule(chunkFileName, protectTreesOrCodeMap.get(chunkFileName) || compilation.assets[chunkFileName].source(), ({moduleFilename, functionNode, tree}) => {
          if (result.filename === moduleFilename) {
            protectTreesOrCodeMap.set(chunkFileName, tree);
            functionNode.body.body = [{
              type: 'Identifier',
              name: result.content
            }]
            found = true;
            return false;
          }
        });
        if (!found) {
          throw new Error(`[Jscrambler] An Inconsistency found with obfuscationLevel=${this.options.obfuscationLevel}. Please contact us.`)
        }
      }
    }

    for(const [chunkFileName, treeOrCode] of protectTreesOrCodeMap.entries()) {
      const bundleCode = typeof treeOrCode === 'string' ? treeOrCode : astring.generate(treeOrCode, {indent: ""});
      compilation.assets[chunkFileName] = {
        source() {
          return bundleCode;
        },
        size() {
          return bundleCode.length;
        }
      };
    }

    // turn off source-maps download if jscramblerOp is instrumentAndDowload
    if (!this.instrument && sourceMaps) {
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
