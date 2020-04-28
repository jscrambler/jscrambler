const readline = require('readline');
const {Command} = require('commander');
const {Readable} = require('stream');
const metroSourceMap = require('metro-source-map');
const {
  JSCRAMBLER_EXTS,
  JSCRAMBLER_END_ANNOTATION,
  JSCRAMBLER_BEG_ANNOTATION,
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
function skipObfuscation() {
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
 * Wrap user code with Jscrambler TAGS {JSCRAMBLER_BEG_ANNOTATION and JSCRAMBLER_END_ANNOTATION}
 * @param {{code: string}} data
 */
function wrapCodeWithTags(data) {
  let startIndex = data.code.indexOf('{');
  const endIndex = data.code.lastIndexOf('}');
  startIndex = shiftStartIndexOnNewLine(startIndex, data.code);
  const init = data.code.substring(0, startIndex + 1);
  const clientCode = data.code.substring(startIndex + 1, endIndex);
  const end = data.code.substr(endIndex, data.code.length);
  data.code = init + JSCRAMBLER_BEG_ANNOTATION + clientCode + JSCRAMBLER_END_ANNOTATION + end;
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
  return relativePath.replace(JSCRAMBLER_EXTS, '.js').substring(1 /* remove '/' */);
}

module.exports = {
  skipObfuscation,
  getBundlePath,
  extractLocs,
  stripJscramblerTags,
  wrapCodeWithTags,
  buildModuleSourceMap,
  buildNormalizePath
}
