const {readFile} = require('fs-extra');
const sourceMap = require('source-map');
const {
  buildNormalizePath,
  extractLocs
} = require('./utils');
const {
  JSCRAMBLER_SOURCE_MAPS_TEMP_FOLDER
} = require('./constants');

/**
 * Merge jscrambler source-maps with metro source-map.
 * Control start/end line of each obfuscated source and calculate amount of lines that needs to
 * be shifted for none-obfuscated code.
 * @param {object} payload
 * @returns {Promise<string>}
 */
module.exports = async function generateSourceMaps(payload) {
  const {
    jscrambler,
    config,
    shouldAddSourceContent,
    protectionId,
    metroUserFilesOnly,
    fileNames,
    debug,
    bundlePath,
    bundleSourceMapPath,
    finalBundle,
    projectRoot,
    metroBundleLocs
  } = payload;

  // download sourcemaps
  delete config.filesSrc;
  await jscrambler.downloadSourceMaps(Object.assign({protectionId}, config));

  // read obfuscated source-map from filesystem
  const obfuscatedSourceMaps = await Promise.all(
    metroUserFilesOnly.map((c, i) =>
      readFile(
        `${JSCRAMBLER_SOURCE_MAPS_TEMP_FOLDER}/${fileNames[i]}.map`,
        'utf8',
      ).catch((e) => {
        if (e.code === 'ENOENT') {
          // when a source file is excluded, the sourcemap is not produced
          return null;
        }
        throw e;
      }),
    ),
  );

  // read metro source-map
  const metroSourceMap = await readFile(bundleSourceMapPath, 'utf8');
  // eslint-disable-next-line camelcase
  const { debugId, debug_id } = JSON.parse(metroSourceMap);
  const finalBundleLocs = await extractLocs(finalBundle);

  const metroSourceMapConsumer = new sourceMap.SourceMapConsumer(metroSourceMap);
  const finalSourceMapGenerator = new sourceMap.SourceMapGenerator({file: bundlePath});
  const ofuscatedSourceMapConsumers = obfuscatedSourceMaps.map((map) =>
    // when a source file is excluded, the sourcemap is not produced
    map ? new sourceMap.SourceMapConsumer(map) : null,
  );

  // add all original sources and sourceContents
  metroSourceMapConsumer.sources.forEach(function (sourceFile) {
    finalSourceMapGenerator._sources.add(sourceFile)
    var sourceContent = metroSourceMapConsumer.sourceContentFor(sourceFile);
    if (shouldAddSourceContent && sourceContent != null) {
      finalSourceMapGenerator.setSourceContent(sourceFile, sourceContent)
    }
  });

  let shiftLines = 0;
  let tmpShiftLine = 0;
  let currSource;
  metroSourceMapConsumer.eachMapping(mapping => {
    const original = mapping.originalLine ? {line: mapping.originalLine, column: mapping.originalColumn} : null;
    let newMappings = [{
      original,
      source: mapping.source,
      name: mapping.name,
      generated: {
        line: mapping.generatedLine,
        column: mapping.generatedColumn
      }
    }];
    const normalizePath = buildNormalizePath(mapping.source, projectRoot);
    const fileNamesIndex = fileNames.indexOf(normalizePath);

    if (currSource !== normalizePath) {
      // next source
      currSource = normalizePath;
      shiftLines = tmpShiftLine;
    }

    if (
      fileNamesIndex !== -1 &&
      /* check if sourceMap was loaded */
      ofuscatedSourceMapConsumers[fileNamesIndex]
    ) {
      /* jscrambler obfuscated files */
      const {lineStart, lineEnd, columnStart} = metroBundleLocs[fileNamesIndex];
      const {lineStart: finalLineStart, lineEnd: finalLineEnd} = finalBundleLocs[fileNamesIndex];
      const allGeneratedPositionsFor = ofuscatedSourceMapConsumers[fileNamesIndex].allGeneratedPositionsFor({
        source: normalizePath,
        line: mapping.generatedLine - lineStart + 1 /* avoid line=0 */,
        column:
          mapping.generatedColumn -
          (mapping.generatedLine === lineStart
            ? columnStart /* column start should be applied only to the first line */
            : 0),
      });

      if (allGeneratedPositionsFor.length === 0) {
        // no match
        return;
      }

      newMappings = allGeneratedPositionsFor.map(({line: obfLine, column: obfColumn}) => {
        const calcFinalLine = finalLineStart + obfLine - 1;
        // add columnStart only on the first line
        const calcFinalColumn = obfLine === 1 ? columnStart + obfColumn : obfColumn;

        debug && console.log('original', original, '->', 'final', {line: calcFinalLine, column: calcFinalColumn});

        return Object.assign({}, newMappings[0], {
          generated: {
            line: calcFinalLine,
            column: calcFinalColumn
          }
        });
      });

      // shift lines on next files
      tmpShiftLine = finalLineEnd - lineEnd;
    } else {
      /* vendor code */
      newMappings[0].generated.line += shiftLines;

      // when the original line/column can't be found, it means that there isn't a real source file associated.
      // Thus, if source file name exists it must be cleaned (f.e ".") to avoid an invalid mapping error
      if (newMappings[0].original === null && newMappings[0].source) {
        newMappings[0].source = null;
      }
    }

    newMappings.forEach((newMapping) => finalSourceMapGenerator.addMapping(newMapping));
  })

  let finalSourceMaps = finalSourceMapGenerator.toString();

  // for when react native debugIds are necessary in the sourcemaps (upload to sentry for example)
  // needs to be added in the end since the debugIds are not in SourceMapGenerator type
  // eslint-disable-next-line camelcase
  if (debugId || debug_id) {
    const JSONFinalSource = {
      ...JSON.parse(finalSourceMaps),
      ...(debugId && { debugId }),
      // eslint-disable-next-line camelcase
      ...(debug_id && { debug_id }),
    };
    finalSourceMaps = JSON.stringify(JSONFinalSource);
  }

  return finalSourceMaps;
};
