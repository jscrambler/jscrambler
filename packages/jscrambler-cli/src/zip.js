import size from 'lodash.size';
import temp from 'temp';
import JSZip from 'jszip';
import {outputFile, readFile, stat} from 'fs-extra';
import {isAbsolute, join, normalize, relative, resolve, sep} from 'path';
import {inspect} from 'util';

const debug = !!process.env.DEBUG;

export function zip (files, cwd, outputTemp = true) {
  debug && console.log('Zipping files', inspect(files));

  if (cwd) {
    cwd = normalize(cwd);
  }

  // If it's already a zip file
  if (files.length === 1 && /^.*\.zip$/.test(files[0])) {
    const zip = new JSZip();

    return readFile(files[0]).then(zipFile => {
      if (outputTemp) {
        return outputFile(temp.path({suffix: '.zip'}), zipFile)
          .then(() => zip.load(zipFile));
      } else {
        return zip.load(zipFile);
      }
    });
  }

  const res = [];
  const zip = new JSZip();

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

    if (files[i].contents) { // if buffer
      name = relative(files[i].cwd, files[i].path);
      buffer = files[i].contents;

      zip.file(name, buffer);
      res.push(true);
    } else {
      let isFile = stat(sPath).then(stats => {
        if (stats.isDirectory()) {
          zip.folder(sPath);

          return false;
        }

        if (cwd && files[i].indexOf && files[i].indexOf(cwd) === 0) {
          name = files[i].substring(cwd.length);
        } else {
          name = files[i];
        }

        return readFile(sPath).then(buffer => {
          zip.file(name, buffer);

          return true;
        });
      });

      res.push(isFile);
    }
  }

  return Promise.all(res).then(hasFiles => {
    if (hasFiles.every(isFile => isFile === false)) {
      throw new Error('No source files found. If you intend to send a whole directory suffix your path with "**" (e.g. ./my-directory/**)');
    }

    if (outputTemp) {
      return outputFile(temp.path({suffix: '.zip'}), zip.generate({type: 'nodebuffer'}), {encoding: 'base64'})
        .then(() => zip);
    } else {
      return zip;
    }
  });
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

export function unzip(zipFile, dest, stream = true) {
  const zip = new JSZip(zipFile);
  const _size = size(zip.files);

  const results = [];
  const outfiles = [];

  for (const file in zip.files) {
    if (zip.files[file].options.dir) {
      continue;
    }

    const buffer = zip.file(file).asNodeBuffer();

    if (typeof dest === 'function') {
      if (stream) {
        dest(buffer, file);
      } else {
        results.push({filename: file, content: buffer});
      }
    } else if (dest && typeof dest === 'string') {
      let destPath;

      if (_size === 1 && dest[dest.length - 1] !== sep) {
        destPath = dest;
      } else if (isWinAbsolutePath(file)) {
        destPath = join(dest, parseWinAbsolutePath(file).path);
      } else {
        destPath = join(dest, file);
      }

      outfiles.push(outputFile(destPath, buffer));
    }
  }

  if (!stream) {
    dest(results);
  }

  return Promise.all(outfiles);
}
