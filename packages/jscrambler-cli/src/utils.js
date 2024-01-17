import glob from 'glob';
import fs from 'fs';
import { existsSync, readFileSync } from 'fs-extra'

/**
 * Return the list of matched files for minimatch patterns.
 * @param {string} pattern
 * @returns {string[]}
 */
export function getMatchedFiles(pattern) {
  let matchedFiles = glob.sync(pattern, {
    dot: true
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

  if(cwd) {
    target = join(cwd, target);
  }

  if(target === path) {
    const { source, type } = scriptObject;

    if(!existsSync(source)) {
      throw new Error('Provided script file does not exist');
    }

    const fileContent = buffer;
    const scriptContent = readFileSync(source);

    const concatContent = type === 'append-js' 
      ? handleScriptConcatenation(fileContent, scriptContent)
      : handleScriptConcatenation(scriptContent, fileContent); 

    buffer = Buffer.from(concatContent, 'utf-8');
  }

  return buffer;
}

export function isJavascriptFile (filename) {
  const fileExtension = filename.split('.').pop().toLowerCase();

  return fileExtension === 'js';
}