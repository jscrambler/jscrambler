const {copy, emptyDir, mkdirp, readFile, writeFile} = require('fs-extra');
const jscrambler = require('jscrambler').default;
const fs = require('fs');
const path = require('path');
const generateSourceMaps = require('./sourceMaps');
const globalThisPolyfill = require('./polyfills/globalThis');

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
  {fileNames, entryPointCode},
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

  const addShowSource = addHermesShowSourceDirective(config);

  if (addShowSource) {
    console.log(`info Jscrambler 'show source' directive added`);
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
    return `${acc}${JSCRAMBLER_BEG_ANNOTATION}${showSource ? '"show source";' : ''}${startAtFirstColumn ? '\n' : ''}${obfuscatedCode}${tillCodeEnd}`;
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

/**
 * Add serialize.processModuleFilter option to metro and attach listener to beforeExit event.
 * *config.fileSrc* and *config.filesDest* will be ignored.
 * @param {{enable: boolean, enabledHermes: boolean }} _config
 * @param {string} [projectRoot=process.cwd()]
 * @returns {{serializer: {processModuleFilter(*): boolean}}}
 */
module.exports = function (_config = {}, projectRoot = process.cwd()) {
  const skipReason = skipObfuscation(_config);
  if (skipReason) {
    console.log(`warning: Jscrambler Obfuscation SKIPPED [${skipReason}]`);
    return {};
  }

  const bundlePath = getBundlePath();
  // make sure jscrambler-metro-plugin is properly configure on metro bundler
  let calledByMetro = false;
  const fileNames = new Set();
  const sourceMapFiles = [];
  const config = Object.assign({}, jscrambler.config, _config);
  const instrument = !!config.instrument;
  let entryPointCode;

  if (config.filesDest || config.filesSrc) {
    console.warn('warning: Jscrambler fields filesDest and fileSrc were ignored. Using input/output values of the metro bundler.')
  }

  if (!Array.isArray(config.params) || config.params.length === 0) {
    console.warn('warning: Jscrambler recommends you to declare your transformations list on the configuration file.')
  }

  process.on('beforeExit', async function (exitCode) {
    try{
      if (!calledByMetro) {
        throw new Error('*jscrambler-metro-plugin* was not properly configured on metro.config.js file. Please verify our documentation in https://docs.jscrambler.com/code-integrity/frameworks-and-libraries/react-native/integration.');
      }

      console.log(
        instrument
          ? 'info Jscrambler Instrumenting Code'
          : `info Jscrambler Obfuscating Code ${
              config.enabledHermes
                ? "(Using Hermes Engine)"
                : "(If you are using Hermes Engine set enabledHermes=true)"
            }`,
      );

      // check for incompatible transformations and turn off code hardening
      handleHermesIncompatibilities(config);

      // start obfuscation
      await obfuscateBundle(bundlePath, {fileNames: Array.from(fileNames), entryPointCode}, sourceMapFiles, config, projectRoot);
    } catch(err) {
      console.error(err);
      process.exit(1);
    } finally {
      process.exit(exitCode)
    }
  });

  return {
    serializer: {
      /**
       * Select user files ONLY (no vendor) to be obfuscated. That code should be tagged with
       * {@JSCRAMBLER_BEG_ANNOTATION} and {@JSCRAMBLER_END_ANNOTATION}.
       * Also gather metro source-maps in case of instrumentation process.
       * @param {{output: Array<*>, path: string, getSource: function():Buffer}} _module
       * @returns {boolean}
       */
      processModuleFilter(_module) {
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
          if (modulePath.includes(INIT_CORE_MODULE)){
            entryPointCode = data.code;
          }
          data.code = wrapCodeWithTags(data.code);
        });
        return true;
      }
    }
  };
};
