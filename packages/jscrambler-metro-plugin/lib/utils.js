const fs = require('fs');
const readline = require('readline');
const {Command} = require('commander');
const {Readable} = require('stream');
const metroSourceMap = require('metro-source-map');
const {
  JSCRAMBLER_EXTS,
  JSCRAMBLER_END_ANNOTATION,
  JSCRAMBLER_BEG_ANNOTATION,
  JSCRAMBLER_SELF_DEFENDING,
  JSCRAMBLER_TOLERATE_BENIGN_POISONING,
  JSCRAMBLER_GLOBAL_VARIABLE_INDIRECTION,
  BUNDLE_OUTPUT_CLI_ARG,
  BUNDLE_SOURCEMAP_OUTPUT_CLI_ARG,
  BUNDLE_DEV_CLI_ARG,
  BUNDLE_CMD
} = require('./constants');

/**
 * Only 'bundle' command triggers obfuscation.
 * Development bundles will be ignored (--dev true). Use JSCRAMBLER_METRO_DEV to override this behaviour.
 * @returns {string} skip reason. If falsy value dont skip obfuscation
 */
function skipObfuscation(config) {
  if (
    typeof config === 'object' &&
    config !== null &&
    config.enable === false
  ) {
    return 'Explicitly Disabled';
  }

  let isBundleCmd = false;
  const command = new Command();
  command
    .command(BUNDLE_CMD)
    .allowUnknownOption()
    .action(() => (isBundleCmd = true));
  command.option(`${BUNDLE_DEV_CLI_ARG} <boolean>`).parse(process.argv);
  if (!isBundleCmd) {
    return 'Not a *bundle* command';
  }
  if (command.dev === 'true') {
    return (
      process.env.JSCRAMBLER_METRO_DEV !== 'true' &&
      'Development mode. Override with JSCRAMBLER_METRO_DEV=true environment variable'
    );
  }
  return null;
}

/**
 * Get bundle path based CLI arguments
 * @returns {{bundlePath: string, bundleSourceMapPath: string}}
 * @throws {Error} when bundle output was not found
 */
function getBundlePath() {
  const command = new Command();
  command
    .option(`${BUNDLE_OUTPUT_CLI_ARG} <string>`)
    .option(`${BUNDLE_SOURCEMAP_OUTPUT_CLI_ARG} <string>`)
    .parse(process.argv);
  if (command.bundleOutput) {
    return {
      bundlePath: command.bundleOutput,
      bundleSourceMapPath: command.sourcemapOutput
    };
  }
  console.error('Bundle output path not found.');
  return process.exit(-1);
}

/**
 * Extract the lines of code for a given string.
 * @param {string} inputStr
 * @returns {Promise<[{lineStart: number, columnStart: number, lineEnd: number}]>}
 */
function extractLocs(inputStr) {
  let locs = [];
  let lines = 0;
  return new Promise((res, rej) =>
    readline.createInterface({
      input: new Readable({
        read() {
          this.push(this.sent ? null : inputStr);
          this.sent = true;
        }
      }),
      crlfDelay: Infinity,
      terminal: false,
      historySize: 0
    })
      .on('line', line => {
        lines++;
        const startTagIndex = line.indexOf(JSCRAMBLER_BEG_ANNOTATION);
        if (startTagIndex !== -1) {
          locs.push({
            lineStart: lines,
            columnStart: startTagIndex
          });
        }

        if (line.indexOf(JSCRAMBLER_END_ANNOTATION) !== -1) {
          locs[locs.length - 1].lineEnd = lines;
        }
      })
      .on('close', () => res(locs))
      .on('error', rej)
  )
}

/**
 * Strip all Jscrambler tags from code
 * @param {string} code
 * @returns {string}
 */
function stripJscramblerTags(code) {
  return code.replace(new RegExp(JSCRAMBLER_BEG_ANNOTATION, 'g'), '')
    .replace(new RegExp(JSCRAMBLER_END_ANNOTATION, 'g'), '')
}

/**
 * When next character is a new line (\n or \r\n),
 * we should increment startIndex to avoid user code starting with a new line.
 * @param {string} startIndex
 * @param {string} code
 * @returns {number}
 * @example
 *    __d(function(g,r,i,a,m,e,d){(detect new line here and start below)
 *      // user code
 *      ...
 *    }
 */
function shiftStartIndexOnNewLine(startIndex, code) {
  switch (code[startIndex + 1]) {
    case '\r':
      startIndex++;
      return shiftStartIndexOnNewLine(startIndex, code);
    case '\n':
      startIndex++;
      break;
  }
  return startIndex;
}

/**
 * Wrap code with Jscrambler TAGS {JSCRAMBLER_BEG_ANNOTATION and JSCRAMBLER_END_ANNOTATION}
 * @param {string} code
 */
function wrapCodeWithTags(code) {
  let startIndex = code.indexOf('{');
  const endIndex = code.lastIndexOf('}');
  startIndex = shiftStartIndexOnNewLine(startIndex, code);
  const init = code.substring(0, startIndex + 1);
  const clientCode = code.substring(startIndex + 1, endIndex);
  const end = code.substr(endIndex, code.length);
  const codeWithTags = init + JSCRAMBLER_BEG_ANNOTATION + clientCode + JSCRAMBLER_END_ANNOTATION + end;

  return codeWithTags;
}

/**
 * Use 'metro-source-map' to build a standard source-map from raw mappings
 * @param {{code: string, map: Array.<Array<number>>}} output
 * @param {string} modulePath
 * @param {string} source
 * @returns {string}
 */
function buildModuleSourceMap(output, modulePath, source) {
  return metroSourceMap
    .fromRawMappings([
      {
        ...output,
        source,
        path: modulePath
      }
    ])
    .toString(modulePath);
}

/**
 * @param {string} path
 * @param {string} projectRoot
 * @returns {string} undefined if path is empty or invalid
 *
 * @example
 *    <project_root>/react-native0.59-grocery-list/App/index.js -> App/index.js
 *    <project_root>/react-native0.59-grocery-list/App/index.ts -> App/index.js
 */
function buildNormalizePath(path, projectRoot) {
  if (typeof path !== 'string' || path.trim().length === 0) {
    return;
  }
  const relativePath = path.replace(projectRoot, '');
  const relativePathWithLeadingSlash = relativePath.replace(JSCRAMBLER_EXTS, '.js');
  if (process.platform === 'win32') {
    return relativePathWithLeadingSlash;
  }
  return relativePathWithLeadingSlash.substring(1 /* remove '/' */);
}

function getCodeBody(code) {
  const bodyBegIndex = code.indexOf("{");
  const bodyEndIndex = code.lastIndexOf("}");
  // +1 to include last '}'
  return code.substring(bodyBegIndex, bodyEndIndex + 1);
}

function stripEntryPointTags(metroBundle, entryPointMinified) {
  const entryPointBody = getCodeBody(entryPointMinified);
  const entryPointBodyWithTags = wrapCodeWithTags(entryPointBody);
  const metroChunksByEntrypoint = metroBundle.split(entryPointBodyWithTags);
  // restore entrypoint original code
  metroChunksByEntrypoint.splice(1, 0, entryPointBody);
  return metroChunksByEntrypoint.join('');
}

/**
 * Check if some file is readable
 * @param {string} path filename path to be tested
 * @returns {Promise<boolean>} true if readable, otherwise false
 */
const isFileReadable = (path) => new Promise((resolve) => {
  fs.access(path, fs.constants.F_OK | fs.constants.R_OK, error => resolve(!error))
})

const addBundleArgsToExcludeList = (chunk, excludeList) => {
  const regex = /\(([0-9a-zA-Z_,]+)\){$/gm;
  const m = regex.exec(chunk);
  if (Array.isArray(m) && m.length > 1) {
    for (const arg of m[1].split(",")) {
      if (!excludeList.includes(arg)) {
        excludeList.push(arg);
      }
    }
    return;
  }

  console.error(`Unable to add global variables to the exclude list.`);
  process.exit(1);
};

function handleExcludeList(config, {supportsExcludeList, excludeList}) {
  if (supportsExcludeList) {
    config.excludeList = excludeList;
  } else {
    // add excludeList to gvi in case the api does not support global excludeList
    if (Array.isArray(config.params)) {
      const gvi = config.params.find(
          (param) => param.name === JSCRAMBLER_GLOBAL_VARIABLE_INDIRECTION
      );
      if (gvi) {
        gvi.options = gvi.options || {};
        const mixedList = [
          ...new Set(excludeList.concat(gvi.options.excludeList || [])),
        ];
        gvi.options.excludeList = mixedList;
      }
    }
  }
}

function injectTolerateBegninPoisoning(config) {
  if (Array.isArray(config.params)) {
    const sd = config.params.find(
        (param) => param.name === JSCRAMBLER_SELF_DEFENDING
    );
    if (sd) {
      sd.options = sd.options || {};
      sd.options.options = sd.options.options || [];
      if (
          Array.isArray(sd.options.options) &&
          !sd.options.options.includes(JSCRAMBLER_TOLERATE_BENIGN_POISONING)
      ) {
        console.log(`info Jscrambler Tolerate benign poisoning option was automatically added to Self-Defending.`);
        sd.options.options.push(JSCRAMBLER_TOLERATE_BENIGN_POISONING)
      }
    }
  }
}

module.exports = {
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
  wrapCodeWithTags
};
