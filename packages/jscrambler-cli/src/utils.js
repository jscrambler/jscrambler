import { glob } from 'glob';
import fs from 'fs';
import { extname, join, normalize } from 'path';
import acorn from "acorn";
import walk from "acorn-walk";
import MagicString from "magic-string";

const debug = !!process.env.DEBUG;

/**
 * Return the list of matched files for minimatch patterns.
 * @param {string} pattern
 * @returns {string[]}
 */
export function getMatchedFiles(pattern) {
  let matchedFiles = glob.sync(pattern, {
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

export const APPEND_JS_TYPE = 'append-js';
export const PREPEND_JS_TYPE = 'prepend-js';
export const WEBPACK_IGNORE_VENDORS = 'webpack-ignore-vendors';

/**
 *
 * @param {source: string} beforeProtection
 * @param {string} cwd current working directory, passed by argument
 * @param {string} path file path (file being parsed)
 * @param {Buffer} buffer file contents
 */
export function webpackAttachDisableAnnotations(beforeProtection, cwd, path, buffer) {
  const { excludeModules } = beforeProtection;

  const sourceCode = buffer.toString('utf-8');

  try {
    const tree = acorn.parse(sourceCode, {
      ecmaVersion: 'latest',
      range: true
    });
  } catch (e) {
    console.log(`Error on beforeProtection (${WEBPACK_IGNORE_VENDORS}): invalid source file.`);
    process.exit(1);
  }

  const appendDisableAnnotationAt = [];
  walk.recursive(tree, null, {
    Property(node) {
      if (node.computed === false && node.shorthand === false) {
        let moduleId;
        if (node.key.type === 'Literal') {
          moduleId = node.key.value;
        } else  if (node.key.type === 'Identifier') {
          moduleId = node.key.name;
        }

        if (moduleId && excludeModules.has(moduleId)) {
          appendDisableAnnotationAt.push(node.value.start);
          if (debug) {
            console.debug(`beforeProtection (${WEBPACK_IGNORE_VENDORS}): ignoring ${excludeModules.get(moduleId)}`);
          }
          return null;
        }
      }
    }
  });

  if (appendDisableAnnotationAt.length > 0) {
    const s = new MagicString(sourceCode);
    for (const appendIndex of appendDisableAnnotationAt) {
      s.appendLeft(appendIndex, '/* @jscrambler disable * */');
    }

    const sourceCodeWithDisableAnnotations = s.toString();

    try {
      // syntax check
      acorn.parse(sourceCodeWithDisableAnnotations, {
        ecmaVersion: 'latest',
        range: true
      })
    } catch (e) {
      console.log(`Error on beforeProtection (${WEBPACK_IGNORE_VENDORS}): ignoring webpack vendors produced an invalid javascript file.`);
      process.exit(1);
    }

    buffer = Buffer.from(s.toString(), 'utf8');
  }

  console.log(`beforeProtection (${WEBPACK_IGNORE_VENDORS}): ${appendDisableAnnotationAt.length} module(s) ignored`);

  return buffer;
}


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

    const fileContent = fs.readFileSync(target);
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
