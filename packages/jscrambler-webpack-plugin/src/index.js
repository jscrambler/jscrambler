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
const PLUGIN_NAME = 'JscramblerPlugin';
const OBFUSCATION_LEVELS = {
  MODULE: 'module',
  BUNDLE: 'bundle'
}
const OBFUSCATION_HOOKS = {
  EMIT: 'emit',
  PROCESS_ASSETS: 'processAssets'
}

class JscramblerPlugin {
  constructor(_options) {
    let options = _options;
    if (typeof options !== 'object' || Array.isArray(options)) options = {};

    this.options = Object.assign({
      excludeList: [],
      obfuscationHook: 'emit',
      obfuscationLevel: OBFUSCATION_LEVELS.BUNDLE
    }, options, {
      clientId: 2,
    });

    if(![OBFUSCATION_LEVELS.BUNDLE, OBFUSCATION_LEVELS.MODULE].includes(this.options.obfuscationLevel)) {
      throw new Error(`Unknown obfuscation level ${this.options.obfuscationLevel}. Options: ${OBFUSCATION_LEVELS.BUNDLE} or ${OBFUSCATION_LEVELS.MODULE}`)
    }

    if(![OBFUSCATION_HOOKS.EMIT, OBFUSCATION_HOOKS.PROCESS_ASSETS].includes(this.options.obfuscationHook)) {
      throw new Error(`Unknown obfuscation hook ${this.options.obfuscationHook}. Options: ${OBFUSCATION_HOOKS.EMIT} or ${OBFUSCATION_HOOKS.PROCESS_ASSETS}`)
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
      console.warn(`(${PLUGIN_NAME}) Options *filesSrc* and *filesDest* were ignored. Webpack entry and output fields will be used instead!`)
    }

    if (typeof this.options.ignoreFile === 'string') {
      if (basename(this.options.ignoreFile) !== JSCRAMBLER_IGNORE) {
        throw new Error(`(${PLUGIN_NAME}) *ignoreFile* option must point to .jscramblerignore file`);
      }
      this.ignoreFileSource = {content: readFileSync(this.options.ignoreFile, { encoding: 'utf-8'}), filename: JSCRAMBLER_IGNORE};
    }

    if (this.options.obfuscationLevel === OBFUSCATION_LEVELS.MODULE) {
      if (sourceMaps) {
        throw new Error(`(${PLUGIN_NAME}) obfuscationLevel=${this.options.obfuscationLevel} is not compatible with source maps generation.`)
      }
      if (!Array.isArray(this.options.chunks)) {
        throw new Error(`(${PLUGIN_NAME}) when obfuscationLevel=${this.options.obfuscationLevel} you must specify the chunks list`);
      }
      console.log(`(${PLUGIN_NAME}) Obfuscation Level set to module`)
    }

    if (sourceMaps && this.options.obfuscationHook === OBFUSCATION_HOOKS.PROCESS_ASSETS) {
      throw new Error(`(${PLUGIN_NAME}) source-maps are not compatible with obfuscationHook=${this.options.obfuscationHook}`)
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

  getWebpackMajorVersion(compiler) {
    if (!compiler.hooks) {
      return 3;
    }

    return compiler.webpack && typeof compiler.webpack.version === 'string' ? parseInt(compiler.webpack.version.split('.')[0], 10) : 4;
  }

  updateJscramblerObfuscationAsset(compilation, assets, filename, newContent) {
    if (compilation && typeof compilation.updateAsset === 'function' && compilation.compiler) {
      compilation.updateAsset(filename, new compilation.compiler.webpack.sources.RawSource(newContent));
    } else if (newContent instanceof SourceMapSource) {
      assets[filename] = newContent;
    } else {
      assets[filename] = {
        source() {
          return newContent;
        },
        size() {
          return newContent.length;
        }
      };
    }
  }

  /**
   * The hooks setup depend on the webpack version
   *  - <= v3 use compiler.plugin
   *  - v4 or if sourcemaps it set use compiler.hooks.emit
   *  - >= v5 use processAssets hook
   * @param compiler
   * @returns {function(*): *}
   */
  attachHooks(compiler) {
    const webpackMajorVersion = this.getWebpackMajorVersion(compiler);
    // noinspection FallThroughInSwitchStatementJS
    switch (webpackMajorVersion) {
      case 3:
        return (arg) => compiler.plugin(this.options.obfuscationHook, (compilation, callback) => {
          compilation.updateJscramblerObfuscationAsset = this.updateJscramblerObfuscationAsset.bind(this, undefined);
          arg(compilation, callback);
        });

      case 4:
        if (this.options.obfuscationHook === OBFUSCATION_HOOKS.PROCESS_ASSETS) {
          throw new Error(`obfuscation hook ${this.options.obfuscationHook} is only compatible with webpack version 5 or higher. Change to: ${OBFUSCATION_HOOKS.EMIT} (default)`)
        }

      case 5:
      default:
        if (this.options.obfuscationHook === OBFUSCATION_HOOKS.EMIT || sourceMaps /* fixme on >= v5 */ || Number.isNaN(webpackMajorVersion) || webpackMajorVersion === 4) {
          return (arg) => compiler.hooks.emit.tapAsync(PLUGIN_NAME, (compilation, callback) => {
            compilation.updateJscramblerObfuscationAsset = this.updateJscramblerObfuscationAsset.bind(this, undefined);
            arg(compilation, callback);
          });
        }

        return (arg) =>
            compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) =>
                compilation.hooks.processAssets.tapAsync(
                    {
                      name: PLUGIN_NAME,
                      stage: compilation.PROCESS_ASSETS_STAGE_OPTIMIZE
                    },
                    (assets, callback) => {
                      const chunks = [];
                      Object.keys(assets).forEach((pathname) => {
                        if (/\.(js|html|htm)$/i.test(pathname)) {
                          chunks.push({files: [pathname], name: pathname.substring(0, pathname.lastIndexOf('.'))});
                        }
                      });
                      arg({chunks, assets, compiler: compilation.compiler, updateJscramblerObfuscationAsset: this.updateJscramblerObfuscationAsset.bind(this, compilation)}, callback);
                    })
            );
    }
  }

  apply(compiler) {
    const enable =
      this.options.enable !== undefined ? this.options.enable : true;

    if (!enable) {
      return;
    }

    this.attachHooks(compiler)((compilation, callback) => {
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
        compilation.updateJscramblerObfuscationAsset(compilation.assets, `${sourceFilename}.map`, result.content);

        const content = compilation.assets[sourceFilename].source();
        compilation.updateJscramblerObfuscationAsset(compilation.assets, sourceFilename, new SourceMapSource(
            content,
            sourceFilename,
            sm
        ));
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
      compilation.updateJscramblerObfuscationAsset(compilation.assets, chunkFileName, bundleCode);
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
