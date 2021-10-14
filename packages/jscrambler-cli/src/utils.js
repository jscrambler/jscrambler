import glob from 'glob';
import fs from 'fs';

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
