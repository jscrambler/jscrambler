import { globSync } from 'glob';
import fs from 'fs';
import { extname, join, normalize, resolve, relative, sep, isAbsolute } from 'path';
import filesizeParser from 'filesize-parser';

/**
 * Return the list of matched files for minimatch patterns.
 * @param {string} pattern
 * @returns {string[]}
 */
export function getMatchedFiles(pattern) {
  let matchedFiles = globSync(pattern, {
    dot: true,
  });

  // special case when the real file name contains a minimatch expression (f.e [id]-1234.js)
  if (matchedFiles.length === 0 && fs.existsSync(pattern)) {
    matchedFiles = [pattern];
  }
  return matchedFiles;
}

export function validateNProtections(n) {
  if (n === undefined) {
    return n;
  }

  const nProtections = parseInt(n, 10);
  if (
    Number.isNaN(nProtections) ||
    nProtections.toString() !== n.toString() ||
    nProtections < 1
  ) {
    console.error(
      `*protections* requires an integer greater than 0.`
    );
    process.exit(1);
  }
  return nProtections;
}

/**
 * Validate protection `customLabels`: a plain object with non-empty keys and string values.
 * @param {*} customLabels From config or programmatic options; omit or pass `undefined` for none.
 * @returns {Object.<string, string>} A shallow copy when valid; `{}` when `customLabels` is `undefined`.
 * @throws {Error} If `customLabels` is `null`, an array, a non-object, or has invalid keys/values.
 */
export function validateCustomLabels(customLabels) {
  if (typeof customLabels === 'undefined') {
    return {};
  }
  if (
    customLabels === null ||
    typeof customLabels !== 'object' ||
    Array.isArray(customLabels)
  ) {
    throw new Error(
      'Invalid *customLabels*: expected a plain object. Eg: { "env": "production", "version": "9.2.2" }',
    );
  }
  const out = {};
  for (const key of Object.keys(customLabels)) {
    if (!key) {
      throw new Error(
        'Invalid *customLabels*: keys must be non-empty strings. Eg: { "env": "production", "version": "9.2.2" }',
      );
    }
    const value = customLabels[key];
    if (typeof value !== 'string') {
      throw new Error(
        `Invalid *customLabels*: value for "${key}" must be a string. Eg: { "env": "production", "version": "9.2.2" }`,
      );
    }
    out[key] = value;
  }
  return out;
}

export const APPEND_JS_TYPE = 'append-js';
export const PREPEND_JS_TYPE = 'prepend-js';

/**
 *
 * @param {*} firstFile if prepending: script file; if appending: target file.
 * @param {*} secondFile if prepending: target file; if appending: script file.
 * @returns first and second files concatenated
 */
function handleScriptConcatenation (firstFile, secondFile) {
  const firstFileContent = firstFile.toString('utf-8');
  const secondFileContent = secondFile.toString('utf-8');

  const concatenatedContent =
    firstFileContent +
    "\n" +
    secondFileContent;

    return concatenatedContent;
}

/**
 *
 * @param {*} scriptObject the object with the script content: { target: '/path/to/target/file', source: '/path/to/script/file', type: 'append-js' | 'prepend-js' }. Its used for both appending and prepending.
 * @param {*} cwd current working directory, passed by argument
 * @param {*} path file path (file being parsed)
 * @param {*} buffer file contents
 */
export function concatenate (scriptObject, cwd, path, buffer) {
  let { target } = scriptObject;

  target = normalize(target);

  if(target === path) {
    const { source, type } = scriptObject;

    if(!fs.existsSync(source)) {
      throw new Error('Provided script file does not exist');
    }

    const fileContent = buffer.toString('utf-8');
    const scriptContent = fs.readFileSync(source);

    const concatContent = type === APPEND_JS_TYPE
      ? handleScriptConcatenation(fileContent, scriptContent)
      : handleScriptConcatenation(scriptContent, fileContent);

    buffer = Buffer.from(concatContent, 'utf-8');
  }

  return buffer;
}

export function isJavascriptFile (filename) {
  const fileExtension = extname(filename);
  const validJsFileExtensions = ['.js', '.mjs', '.cjs'];

  return validJsFileExtensions.includes(fileExtension);
}

export const validateThresholdFn = (optionName) => (val) => {
  let inBytes;
  try {
    inBytes = filesizeParser(val);
  } catch (e) {
    console.error(
      `*${optionName}* requires a valid <threshold> value. Format: {number}{unit="b,kb,mb"}. Example: 200kb`,
    );
    process.exit(1);
  }
  return inBytes;
};

export function resolveOutputPath(outputPath, filename) {
  const outputRoot = resolve(outputPath);
  const finalPath = resolve(outputRoot, filename);
  const relativePath = relative(outputRoot, finalPath);

  if (
    relativePath === '..' ||
    relativePath.indexOf(`..${sep}`) === 0 ||
    isAbsolute(relativePath)
  ) {
    throw new Error(`Refusing to write file outside output directory: ${filename}`);
  }

  return finalPath;
}
