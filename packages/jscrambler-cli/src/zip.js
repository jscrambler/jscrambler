// TODO Replace `sync` functions with async versions

import size from 'lodash.size';
import JSZip from 'jszip';
import * as fs from 'fs/promises';
import {normalize, resolve, relative, join, isAbsolute, dirname} from 'path';
import {inspect} from 'util';
import {
  concatenate,
  APPEND_JS_TYPE,
  PREPEND_JS_TYPE,
  WEBPACK_IGNORE_VENDORS,
  webpackAttachDisableAnnotations,
} from './utils';

const debug = !!process.env.DEBUG;

export async function zip(files, cwd, runBeforeProtection) {
  debug && console.log('Zipping files', inspect(files));
  // Flag to detect if any file was added to the zip archive
  let hasFiles = false;
  // Sanitize `cwd`
  if (cwd) {
    cwd = normalize(cwd);
  }
  // If it's already a zip file
  if (files.length === 1 && /^.*\.zip$/.test(files[0])) {
    hasFiles = true;
    const zipFile = new JSZip();
    const zipFileData = await fs.readFile(files[0]);

    return await zipFile.loadAsync(zipFileData);
  }
  const zipFile = new JSZip();
  for (let i = 0, l = files.length; i < l; ++i) {
    // Sanitise path
    if (typeof files[i] === 'string') {
      files[i] = normalize(files[i]);
      if (files[i].indexOf('../') === 0) {
        files[i] = resolve(files[i]);
      }
    }
    // Bypass unwanted patterns from `files`
    if (/.*\.(git|hg)(\/.*|$)/.test(files[i].path || files[i])) {
      continue;
    }
    let buffer, name;
    let sPath;
    if (cwd && files[i].indexOf && files[i].indexOf(cwd) !== 0) {
      sPath = join(cwd, files[i]);
    } else {
      sPath = files[i];
    }
    // If buffer
    if (files[i].contents) {
      name = relative(files[i].cwd, files[i].path);
      buffer = files[i].contents;
    } else if (!(await fs.stat(sPath)).isDirectory()) {
      // Else if it's a path and not a directory
      if (cwd && files[i].indexOf && files[i].indexOf(cwd) === 0) {
        name = files[i].substring(cwd.length);
      } else {
        name = files[i];
      }
      buffer = await fs.readFile(sPath);

      runBeforeProtection.map((element) => {
        switch(element.type) {
          case APPEND_JS_TYPE:
          case PREPEND_JS_TYPE:
            buffer = concatenate(element, cwd, sPath, buffer, name);
            break;
          case WEBPACK_IGNORE_VENDORS:
            buffer = webpackAttachDisableAnnotations(element, cwd, sPath, buffer, name);
            break;
        }
      });
    } else {
      // Else if it's a directory path
      zipFile.folder(sPath);
    }
    if (name) {
      hasFiles = true;
      zipFile.file(name, buffer);
    }
  }
  if (!hasFiles) {
    throw new Error(
      'No source files found. If you intend to send a whole directory sufix your path with "**" (e.g. ./my-directory/**)'
    );
  }
  return zipFile;
}

export function zipSources(sources) {
  const zipFile = new JSZip();
  const fileNames = sources.map(source => {
    zipFile.file(source.filename, source.content);
    return source.filename;
  });

  if (debug) {
    console.log('Zipping files', inspect(fileNames));
  }
  return Promise.resolve(zipFile);
}

function isWinAbsolutePath(path) {
  return isAbsolute(path) && /^([a-z]:)(.*)/i.test(path);
}

function parseWinAbsolutePath(_path) {
  const [full, drv, path] = _path.match(/^([a-z]:)(.*)/i);
  return {
    drv,
    path
  };
}

export async function unzip(zipFile, dest, stream = true) {
  const zip = new JSZip();
  await zip.loadAsync(zipFile);
  const _size = size(zip.files);

  const results = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const file in zip.files) {
    if (!zip.files[file].dir) {
      const buffer = await zip.file(file).async('nodebuffer');

      if (typeof dest === 'function') {
        if (stream) {
          dest(buffer, file);
        } else {
          results.push({filename: file, content: buffer.toString()});
        }
      } else if (dest && typeof dest === 'string') {
        var destPath;

        const lastDestChar = dest[dest.length - 1];
        if (_size === 1 && lastDestChar !== '/' && lastDestChar !== '\\') {
          destPath = dest;
          const parentPath = dirname(destPath);
          await fs.mkdir(parentPath, { recursive: true });
        } else {
          let _file = file;
          // Deal with win path join c:\dest\:c\src
          if (isWinAbsolutePath(_file)) {
            _file = parseWinAbsolutePath(_file).path;
          }
          destPath = join(dest, _file);
          await fs.mkdir(dirname(destPath), { recursive: true });
        }
        await fs.writeFile(destPath, buffer);
      }
    }
  }

  if (!stream) {
    dest(results);
  }
}
