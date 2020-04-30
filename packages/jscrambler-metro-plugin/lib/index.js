const {emptyDir, mkdirp, readFile, writeFile} = require('fs-extra');
const jscrambler = require('jscrambler').default;
const fs = require('fs');
const path = require('path');
const generateSourceMaps = require('./sourceMaps');
const {
  JSCRAMBLER_CLIENT_ID,
  JSCRAMBLER_TEMP_FOLDER,
  JSCRAMBLER_DIST_TEMP_FOLDER,
  JSCRAMBLER_SRC_TEMP_FOLDER,
  JSCRAMBLER_PROTECTION_ID_FILE,
  JSCRAMBLER_BEG_ANNOTATION,
  JSCRAMBLER_END_ANNOTATION,
  BUNDLE_SOURCEMAP_OUTPUT_CLI_ARG,
  JSCRAMBLER_EXTS
} = require('./constants');
const {
  buildModuleSourceMap,
  buildNormalizePath,
  wrapCodeWithTags,
  extractLocs,
  getBundlePath,
  skipObfuscation,
  stripJscramblerTags
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
  fileNames,
  sourceMapFiles,
  config,
  projectRoot
) {
  await emptyDir(JSCRAMBLER_TEMP_FOLDER);

  const metroBundle = await readFile(bundlePath, 'utf8');
  const metroBundleLocs = await extractLocs(metroBundle);
  const metroBundleChunks = metroBundle.split(JSCRAMBLER_BEG_ANNOTATION);
  const metroUserFilesOnly = metroBundleChunks
    .filter((c, i) => i > 0)
    .map((c, i) => {
      return c.split(JSCRAMBLER_END_ANNOTATION)[0];
    });

  // build tmp src folders structure
  await Promise.all(
    fileNames.map(n =>
      mkdirp(`${JSCRAMBLER_SRC_TEMP_FOLDER}/${path.dirname(n)}`)
    )
  );

  // write user files to tmp folder
  await Promise.all(
    metroUserFilesOnly.map((c, i) =>
      writeFile(`${JSCRAMBLER_SRC_TEMP_FOLDER}/${fileNames[i]}`, c)
    )
  )

  // write source map files to tmp folder (only for Instrumentation process)
  await Promise.all(
    sourceMapFiles.map(({filename, content}) =>
      writeFile(`${JSCRAMBLER_SRC_TEMP_FOLDER}/${filename}`, content)
    )
  )

  // adapt configs for react-native
  config.filesSrc = [`${JSCRAMBLER_SRC_TEMP_FOLDER}/**/*.js?(.map)`];
  config.filesDest = JSCRAMBLER_DIST_TEMP_FOLDER;
  config.cwd = JSCRAMBLER_SRC_TEMP_FOLDER;
  config.clientId = JSCRAMBLER_CLIENT_ID;
  // if omit, we automatically activate sourceMaps generation (no sourceContent) when '--sourcemap-output' arg is set
  config.sourceMaps = config.sourceMaps === undefined ? !!bundleSourceMapPath : config.sourceMaps;
  // must have metro and jscrambler source-maps
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
    readFile(`${JSCRAMBLER_DIST_TEMP_FOLDER}/${fileNames[i]}`, 'utf8')
  ));

  // build final bundle (with JSCRAMBLER TAGS still)
  const finalBundle = metroBundleChunks.reduce((acc, c, i) => {
    if (i === 0) {
      return c;
    }

    const obfuscatedCode = obfusctedUserFiles[i - 1];
    const tillCodeEnd = c.substr(
      c.indexOf(JSCRAMBLER_END_ANNOTATION),
      c.length
    );
    return acc + JSCRAMBLER_BEG_ANNOTATION + obfuscatedCode + tillCodeEnd;
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
    fileNames,
    bundlePath,
    bundleSourceMapPath,
    finalBundle,
    projectRoot,
    debug,
    metroBundleLocs
  });
  await writeFile(bundleSourceMapPath, finalSourceMap);
}

/**
 * Add serialize.processModuleFilter option to metro and attach listener to beforeExit event.
 * *config.fileSrc* and *config.filesDest* will be ignored.
 * @param {object} _config
 * @param {string} [projectRoot=process.cwd()]
 * @returns {{serializer: {processModuleFilter(*): boolean}}}
 */
module.exports = function (_config = {}, projectRoot = process.cwd()) {
  const skipReason = skipObfuscation();
  if (skipReason) {
    console.log(`warning: Jscrambler Obfuscation SKIPPED [${skipReason}]`);
    return {};
  }

  const bundlePath = getBundlePath();
  const fileNames = new Set();
  const sourceMapFiles = [];
  const config = Object.assign({}, jscrambler.config, _config);
  const instrument = !!config.instrument;

  if(config.filesDest || config.filesSrc) {
    console.warn('warning: Jscrambler fields filesDest and fileSrc were ignored. Using input/output values of the metro bundler.')
  }

  process.on('beforeExit', async function (exitCode) {
    try{
      console.log(
        instrument
          ? 'info Jscrambler Instrumenting Code'
          : 'info Jscrambler Obfuscating Code'
      );
      // start obfuscation
      await obfuscateBundle(bundlePath, Array.from(fileNames), sourceMapFiles, config, projectRoot);
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
        if (
          _module.path.indexOf('node_modules') !== -1 ||
          typeof _module.path !== 'string' ||
          !fs.existsSync(_module.path) ||
          !path.extname(_module.path).match(JSCRAMBLER_EXTS)
        ) {
          return true;
        }

        const normalizePath = buildNormalizePath(_module.path, projectRoot);
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
          wrapCodeWithTags(data);
        });
        return true;
      }
    }
  };
};
