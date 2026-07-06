const {copy, emptyDir, mkdirp, readFile, writeFile} = require('fs-extra');
const jscrambler = require('jscrambler').default;
const fs = require('fs');
const path = require('path');
const generateSourceMaps = require('./sourceMaps');
const globalThisPolyfill = require('./polyfills/globalThis');
const { version } = require('../package.json');

const {
  INIT_CORE_MODULE,
  JSCRAMBLER_CLIENT_ID,
  JSCRAMBLER_TEMP_FOLDER,
  JSCRAMBLER_IGNORE,
  JSCRAMBLER_DIST_TEMP_FOLDER,
  JSCRAMBLER_PROTECTION_ID_FILE,
  JSCRAMBLER_BEG_ANNOTATION,
  JSCRAMBLER_END_ANNOTATION,
  BUNDLE_SOURCEMAP_OUTPUT_CLI_ARG,
  HERMES_SHOW_SOURCE_DIRECTIVE,
  JSCRAMBLER_EXTS
} = require('./constants');
const {
  buildModuleSourceMap,
  buildNormalizePath,
  extractLocs,
  getBundlePath,
  isFileReadable,
  skipObfuscation,
  stripEntryPointTags,
  stripJscramblerTags,
  addBundleArgsToExcludeList,
  handleExcludeList,
  injectTolerateBegninPoisoning,
  handleAntiTampering,
  addHermesShowSourceDirective,
  handleHermesIncompatibilities,
  isVegaBuild,
  wrapCodeWithTags
} = require('./utils');

const debug = !!process.env.DEBUG;

function logSourceMapsWarning(hasMetroSourceMaps, hasJscramblerSourceMaps) {
  if (hasMetroSourceMaps) {
    console.log(`warning: Jscrambler source-maps are DISABLED. Check how to activate them in https://docs.jscrambler.com/code-integrity/documentation/source-maps/api`);
  } else if (hasJscramblerSourceMaps) {
    console.log(`warning: Jscrambler source-maps were not generated. Missing metro source-maps (${BUNDLE_SOURCEMAP_OUTPUT_CLI_ARG} is required)`);
  }
}

async function obfuscateBundle(
  {bundlePath, bundleSourceMapPath},
  {fileNames, entryPointCode, isCodeHardeningThresholdSupported},
  sourceMapFiles,
  config,
  projectRoot
) {
  await emptyDir(JSCRAMBLER_TEMP_FOLDER);

  const metroBundle = await readFile(bundlePath, 'utf8');
  const metroBundleLocs = await extractLocs(metroBundle);
  let processedMetroBundle = metroBundle;
  let filteredFileNames = fileNames;
  const excludeList = [];

  const supportsEntryPoint = await jscrambler.introspectFieldOnMethod.call(
    jscrambler,
    config,
    "mutation",
    "createApplicationProtection",
    "entryPoint"
  );

  // ignore entrypoint obfuscation if its not supported
  if (!supportsEntryPoint) {
    delete config.entryPoint;
    if (typeof entryPointCode === 'string' && entryPointCode.length > 0) {
      debug && console.log('debug Jscrambler entrypoint option not supported');
      try {
        filteredFileNames = fileNames.filter(
          name => !name.includes(INIT_CORE_MODULE)
        );
        processedMetroBundle = stripEntryPointTags(
          metroBundle,
          entryPointCode
        );
      } catch (err) {
        console.log("Error processing entry point.");
        process.exit(-1);
      }
    }
  }

  const metroBundleChunks = processedMetroBundle.split(
    JSCRAMBLER_BEG_ANNOTATION
  );
  addBundleArgsToExcludeList(metroBundleChunks[0], excludeList);
  const metroUserFilesOnly = metroBundleChunks.slice(1).map((c, i) => {
    const s = c.split(JSCRAMBLER_END_ANNOTATION);
    // We don't want to extract args from last chunk
    if (i < metroBundleChunks.length - 2) {
      addBundleArgsToExcludeList(s[1], excludeList);
    }
    return s[0];
  });

  const sources = [];
  // .jscramblerignore
  const defaultJscramblerIgnorePath = path.join(projectRoot, JSCRAMBLER_IGNORE);

  if (typeof config.ignoreFile === 'string') {
    if (!await isFileReadable(config.ignoreFile)) {
      console.error(`The *ignoreFile* "${config.ignoreFile}" was not found or is not readable!`);
      process.exit(-1);
    }
    sources.push({ filename: JSCRAMBLER_IGNORE, content: await readFile(config.ignoreFile) })
  } else if (await isFileReadable(defaultJscramblerIgnorePath)) {
    sources.push({ filename: JSCRAMBLER_IGNORE, content: await readFile(defaultJscramblerIgnorePath) })
  }

  // push user files to sources array
  for (let i = 0; i < metroUserFilesOnly.length; i += 1) {
    sources.push({
      filename: filteredFileNames[i], content: metroUserFilesOnly[i]
    })
  }

  // Source map files (only for Instrumentation process)
  for (const { filename, content } of sourceMapFiles) {
    sources.push({
      filename, content
    })
  }

  // adapt configs for react-native
  config.sources = sources;
  config.filesDest = JSCRAMBLER_DIST_TEMP_FOLDER;
  config.clientId = JSCRAMBLER_CLIENT_ID;
  config.clientVersion = version;

  const supportsExcludeList = await jscrambler.introspectFieldOnMethod.call(
    jscrambler,
    config,
    "mutation",
    "createApplicationProtection",
    "excludeList"
  );

  handleExcludeList(config, {supportsExcludeList, excludeList});

  injectTolerateBegninPoisoning(config);

  if (bundleSourceMapPath && typeof config.sourceMaps === 'undefined') {
    console.error(`error Metro is generating source maps that won't be useful after Jscrambler protection.
  If this is not a problem, you can either:
    1) Disable source maps in metro bundler
    2) Explicitly disable Jscrambler source maps by adding 'sourceMaps: false' in the Jscrambler config file

  If you want valid source maps, make sure you have access to the feature and enable it in Jscrambler config file by adding 'sourceMaps: true'`
    );
    process.exit(-1);
  }

  const requireStartAtFirstColumn = handleAntiTampering(
    config,
    processedMetroBundle,
  );

  const addShowSource = addHermesShowSourceDirective(
    config,
    isCodeHardeningThresholdSupported,
  );

  if (addShowSource) {
    console.log(
      `info Jscrambler ${HERMES_SHOW_SOURCE_DIRECTIVE} directive added`,
    );
  }

  const shouldGenerateSourceMaps = config.sourceMaps && bundleSourceMapPath;

  const jscramblerOp = !!config.instrument
    ? jscrambler.instrumentAndDownload
    : jscrambler.protectAndDownload;

  // obfuscate or instrument
  const protectionId = await jscramblerOp.call(jscrambler, config);

  // store protection id
  await writeFile(JSCRAMBLER_PROTECTION_ID_FILE, protectionId);

  // read obfuscated user files
  const obfusctedUserFiles = await Promise.all(metroUserFilesOnly.map((c, i) =>
    readFile(`${JSCRAMBLER_DIST_TEMP_FOLDER}/${filteredFileNames[i]}`, 'utf8')
  ));

  // build final bundle (with JSCRAMBLER TAGS still)
  const finalBundle = metroBundleChunks.reduce((acc, c, i) => {
    if (i === 0) {
      const chunks = c.split('\n');
      return [`${chunks[0]}${globalThisPolyfill}`, ...chunks.slice(1)].join('\n');
    }

    let showSource = addShowSource;
    let startAtFirstColumn = requireStartAtFirstColumn;

    const obfuscatedCode = obfusctedUserFiles[i - 1];
    const sourceFileIgnored = metroUserFilesOnly[i - 1] === obfuscatedCode;

    if (sourceFileIgnored) {
      // restore excluded files
      showSource = false;
      startAtFirstColumn = false;
      debug && console.log(`debug Jscrambler File ${fileNames[i - 1]} was excluded`);
    }

    const tillCodeEnd = c.substr(
      c.indexOf(JSCRAMBLER_END_ANNOTATION),
      c.length
    );
    return `${acc}${JSCRAMBLER_BEG_ANNOTATION}${
      showSource ? HERMES_SHOW_SOURCE_DIRECTIVE : ''
    }${startAtFirstColumn ? '\n' : ''}${obfuscatedCode}${tillCodeEnd}`;
  }, '');

  await writeFile(bundlePath, stripJscramblerTags(finalBundle));
  if(!shouldGenerateSourceMaps) {
    logSourceMapsWarning(bundleSourceMapPath, config.sourceMaps);
    // nothing more to do
    return;
  }

  // process Jscrambler SourceMaps
  const shouldAddSourceContent = typeof config.sourceMaps === 'object' ? config.sourceMaps.sourceContent : false;
  console.log(`info Jscrambler Source Maps (${shouldAddSourceContent ? "with" : "no"} source content)`);
  const finalSourceMap = await generateSourceMaps({
    jscrambler,
    config,
    shouldAddSourceContent,
    protectionId,
    metroUserFilesOnly,
    fileNames: filteredFileNames,
    bundlePath,
    bundleSourceMapPath,
    finalBundle,
    projectRoot,
    debug,
    metroBundleLocs
  });
  await writeFile(bundleSourceMapPath, finalSourceMap);
}

function fileExists(modulePath) {
  return fs.existsSync(modulePath);
}

function isValidExtension(modulePath) {
  return path.extname(modulePath).match(JSCRAMBLER_EXTS);
}

function validateModule(modulePath, config, projectRoot) {
  const instrument = !!config.instrument;

  if (
    !fileExists(modulePath) ||
    !isValidExtension(modulePath) ||
    typeof modulePath !== "string"
  ) {
    return false;
  } else if (modulePath.includes(INIT_CORE_MODULE) && !instrument) {
    // This is the entrypoint file
    config.entryPoint = buildNormalizePath(modulePath, projectRoot);
    return true;
  } else if (modulePath.includes("node_modules")) {
    return false;
  } else {
    return true;
  }
}

let calledByMetro = false;

/**
 * Validates that Metro invoked the Jscrambler serializer integration.
 *
 * If Metro never calls the serializer hook, the plugin was not applied through
 * metro.config.js and the bundle cannot be obfuscated reliably.
 * @returns {void}
 */
function validateIfJscramblerWasApplied() {
  if (!calledByMetro) {
    console.error(
      '*jscrambler-metro-plugin* was not properly configured on metro.config.js file. Please verify our documentation in https://docs.jscrambler.com/code-integrity/frameworks-and-libraries/react-native/integration.',
    );
    process.exit(1);
  }
}

/**
 * Configures the Metro integration for Vega OS builds.
 *
 * Vega OS overrides Metro's processModuleFilter, so this patches Metro's bundle
 * save path to run Jscrambler after Metro writes the output and uses
 * getPolyfills to wrap the final module filter.
 * @param {object} options
 * @param {function(*): boolean} options.applyJscramblerSerializerToModule Applies
 * Jscrambler tagging and filtering to a Metro module.
 * @param {function(string, string=): Promise<void>} options.runObfuscation Runs
 * Jscrambler against the generated bundle and optional source map.
 * @param {string} options.projectRoot Project root used to resolve Metro.
 * @returns {{serializer: {getPolyfills(): string[]}}} Vega OS Metro config.
 */
function setupForVegaOS({
  applyJscramblerSerializerToModule,
  runObfuscation,
  projectRoot,
}) {
  let metroOutput;
  try {
    // eslint-disable-next-line global-require,import/no-dynamic-require
    metroOutput = require(
      require.resolve('metro/src/shared/output/bundle', {
        paths: [projectRoot],
      }),
    );
  } catch (err) {
    console.error(
      `Jscrambler could not hook Metro bundle output (${err.message}). Please contact Jscrambler support team at support@jscrambler.com`,
    );
    process.exit(1);
  }

  const originalSave = metroOutput.save.bind(metroOutput);

  metroOutput.save = async function jscramblerMetroSave(...opts) {
    const [, args] = opts;
    if (typeof args !== 'object' || args === null || !args.bundleOutput) {
      console.error(
        `Jscrambler output bundle could not be found. Please contact Jscrambler support at support@jscrambler.com`,
      );
      process.exit(1);
    }

    const result = await originalSave(...opts);
    if (args && args.bundleOutput) {
      try {
        debug &&
          console.log(
            `debug Jscrambler obfuscating bundle at ${args.bundleOutput}`,
        );
        await runObfuscation(args.bundleOutput, args.sourcemapOutput);
      } catch (err) {
        console.error(err);
        process.exit(1);
      }
    }
    return result;
  };

  return {
    serializer: {
      getPolyfills() {
        // wrap processModuleFilter to apply Jscrambler module filtering
        // due to Amazon overriding processModuleFilter in VegaOS
        const originalProcessModuleFilter = this.processModuleFilter;
        this.processModuleFilter = (_module) => {
          const allow = originalProcessModuleFilter(_module);
          if (allow) {
            applyJscramblerSerializerToModule(_module);
          }
          return allow;
        };
        return require(
          require.resolve('@react-native/js-polyfills', { paths: [projectRoot] }),
        )();
      },
    },
  };
}

/**
 * Configures the Metro integration for React Native builds.
 *
 * Registers a beforeExit hook that obfuscates the bundle produced by Metro and
 * returns a serializer processModuleFilter that tags user modules while Metro
 * serializes them.
 * @param {object} options
 * @param {function(*): boolean} options.applyJscramblerSerializerToModule Applies
 * Jscrambler tagging and filtering to a Metro module.
 * @param {function(string, string=): Promise<void>} options.runObfuscation Runs
 * Jscrambler against the generated bundle and optional source map.
 * @returns {{serializer: {processModuleFilter(*): boolean}}} React Native Metro config.
 */
function setupForReactNative({
  applyJscramblerSerializerToModule,
  runObfuscation,
}) {
  process.on('beforeExit', async (exitCode) => {
    try {
      const bundlePaths = getBundlePath();
      await runObfuscation(
        bundlePaths.bundlePath,
        bundlePaths.bundleSourceMapPath,
      );
      process.exit(typeof exitCode === 'number' ? exitCode : 0);
    } catch (err) {
      console.error(err);
      process.exit(1);
    }
  });

  /**
   * Select user files ONLY (no vendor) to be obfuscated. That code should be tagged with
   * {@JSCRAMBLER_BEG_ANNOTATION} and {@JSCRAMBLER_END_ANNOTATION}.
   * Also gather metro source-maps in case of instrumentation process.
   * @param {{output: Array<*>, path: string, getSource: function():Buffer}} _module
   * @returns {boolean}
   */
  return {
    serializer: {
      processModuleFilter(_module) {
        return applyJscramblerSerializerToModule(_module);
      },
    },
  };
}

/**
 * Add serialize.processModuleFilter option to metro and attach listener to beforeExit event.
 * *config.fileSrc* and *config.filesDest* will be ignored.
 * @param {{enable: boolean, enabledHermes: boolean }} _config
 * @param {string} [projectRoot=process.cwd()]
 * @returns {{serializer: {processModuleFilter?(*): boolean, getPolyfills?(*): string[]}}}
 */
module.exports = function (_config = {}, projectRoot = process.cwd()) {
  const skipReason = skipObfuscation(_config);
  if (skipReason) {
    console.log(`warning: Jscrambler Obfuscation SKIPPED [${skipReason}]`);
    return {};
  }

  const fileNames = new Set();
  const sourceMapFiles = [];
  const config = Object.assign(
    {},
    { enabledHermes: true },
    jscrambler.config,
    _config,
  );
  const instrument = !!config.instrument;
  let entryPointCode;

  if (config.filesDest || config.filesSrc) {
    console.warn('warning: Jscrambler fields filesDest and fileSrc were ignored. Using input/output values of the metro bundler.')
  }

  if (!Array.isArray(config.params) || config.params.length === 0) {
    console.warn('warning: Jscrambler recommends you to declare your transformations list on the configuration file.')
  }

  async function runObfuscation(bundlePath, bundleSourceMapPath) {
    validateIfJscramblerWasApplied();

    console.log(
      instrument
        ? 'info Jscrambler Instrumenting Code'
        : `info Jscrambler Obfuscating Code ${
            config.enabledHermes
              ? "(Using Hermes Engine)"
              : "(If you are using Hermes Engine set enabledHermes=true)"
          }`,
    );

    const isCodeHardeningThresholdSupported =
      await jscrambler.introspectFieldOnMethod.call(
        jscrambler,
        config,
        'mutation',
        'createApplicationProtection',
        'codeHardeningThreshold',
      );

    handleHermesIncompatibilities(config, isCodeHardeningThresholdSupported);
    await obfuscateBundle(
      {bundlePath, bundleSourceMapPath},
      {fileNames: Array.from(fileNames), entryPointCode, isCodeHardeningThresholdSupported},
      sourceMapFiles,
      config,
      projectRoot,
    );

    // clear obfuscation state to allow multiple builds at once
    fileNames.clear();
    sourceMapFiles.splice(0);
    entryPointCode = undefined;
  }

  function applyJscramblerSerializerToModule(_module) {
    calledByMetro = true;
    const modulePath = _module.path;
    const shouldSkipModule = !validateModule(modulePath, config, projectRoot);

    if (shouldSkipModule) {
      return true;
    }
    const normalizePath = buildNormalizePath(modulePath, projectRoot);
    fileNames.add(normalizePath);

    _module.output.forEach(({data}) => {
      if (instrument && Array.isArray(data.map)) {
        sourceMapFiles.push({
          filename: `${normalizePath}.map`,
          content: buildModuleSourceMap(
            data,
            normalizePath,
            _module.getSource().toString()
          )
        });
      }
      if (modulePath.includes(INIT_CORE_MODULE) && entryPointCode === undefined) {
        entryPointCode = data.code;
      }
      data.code = wrapCodeWithTags(data.code);
    });
    return true;
  }

  const options = {
    applyJscramblerSerializerToModule,
    runObfuscation,
    projectRoot,
  };

  const isVegaOS = isVegaBuild();
  if (isVegaOS) {
    console.log(`info Jscrambler VegaOS application`);
  }

  return isVegaOS ? setupForVegaOS(options) : setupForReactNative(options);
};
