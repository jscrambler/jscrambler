import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  APPEND_JS_TYPE,
  PREPEND_JS_TYPE,
  concatenate,
  getMatchedFiles,
  isJavascriptFile,
  validateNProtections,
  validateThresholdFn,
} from '../utils.js';

describe('utils', () => {
  describe('getMatchedFiles', () => {
    it('returns matches for a glob pattern', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscrambler-cli-'));
      const files = ['alpha.js', 'beta.js'];
      files.forEach((file) => {
        fs.writeFileSync(path.join(tempDir, file), '// test');
      });

      const matched = getMatchedFiles(path.join(tempDir, '*.js'));

      expect(matched.sort()).toEqual(
        files.map((file) => path.join(tempDir, file)).sort(),
      );
    });

    it('returns the file when the pattern is a literal file name', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscrambler-cli-'));
      const fileName = '[id]-1234.js';
      const filePath = path.join(tempDir, fileName);
      fs.writeFileSync(filePath, '// test');

      const matched = getMatchedFiles(filePath);

      expect(matched).toEqual([filePath]);
    });

    it('returns an empty array when nothing matches', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscrambler-cli-'));
      const matched = getMatchedFiles(path.join(tempDir, '*.js'));

      expect(matched).toEqual([]);
    });
  });

  describe('validateNProtections', () => {
    it('returns undefined when no value is provided', () => {
      expect(validateNProtections(undefined)).toBeUndefined();
    });

    it('returns a parsed integer when valid', () => {
      expect(validateNProtections('2')).toBe(2);
    });

    it('exits when the value is invalid', () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => validateNProtections('0')).toThrow('process.exit');
      expect(errorSpy).toHaveBeenCalled();

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('exits when the value is not an integer', () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => validateNProtections('2.5')).toThrow('process.exit');
      expect(errorSpy).toHaveBeenCalled();

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('validateThresholdFn', () => {
    it('parses thresholds into bytes', () => {
      const threshold = validateThresholdFn('threshold');
      expect(threshold('200kb')).toBe(204800);
    });

    it('exits when the value is invalid', () => {
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('process.exit');
      });
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const threshold = validateThresholdFn('threshold');
      expect(() => threshold('nope')).toThrow('process.exit');
      expect(errorSpy).toHaveBeenCalled();

      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });

  describe('isJavascriptFile', () => {
    it('returns true for .js, .mjs, and .cjs files', () => {
      expect(isJavascriptFile('file.js')).toBe(true);
      expect(isJavascriptFile('file.mjs')).toBe(true);
      expect(isJavascriptFile('file.cjs')).toBe(true);
    });

    it('returns false for non-JavaScript extensions', () => {
      expect(isJavascriptFile('file.ts')).toBe(false);
      expect(isJavascriptFile('file.json')).toBe(false);
    });
  });

  describe('concatenate', () => {
    it('appends scripts to the target file', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscrambler-cli-'));
      const targetPath = path.join(tempDir, 'target.js');
      const scriptPath = path.join(tempDir, 'script.js');
      fs.writeFileSync(scriptPath, 'console.log("script");');

      const buffer = Buffer.from('console.log("target");', 'utf-8');
      const result = concatenate(
        { target: targetPath, source: scriptPath, type: APPEND_JS_TYPE },
        tempDir,
        targetPath,
        buffer,
      );

      expect(result.toString('utf-8')).toBe(
        'console.log("target");\nconsole.log("script");',
      );
    });

    it('prepends scripts to the target file', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscrambler-cli-'));
      const targetPath = path.join(tempDir, 'target.js');
      const scriptPath = path.join(tempDir, 'script.js');
      fs.writeFileSync(scriptPath, 'console.log("script");');

      const buffer = Buffer.from('console.log("target");', 'utf-8');
      const result = concatenate(
        { target: targetPath, source: scriptPath, type: PREPEND_JS_TYPE },
        tempDir,
        targetPath,
        buffer,
      );

      expect(result.toString('utf-8')).toBe(
        'console.log("script");\nconsole.log("target");',
      );
    });

    it('throws when the script file is missing', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscrambler-cli-'));
      const targetPath = path.join(tempDir, 'target.js');
      const scriptPath = path.join(tempDir, 'missing.js');
      const buffer = Buffer.from('console.log("target");', 'utf-8');

      expect(() =>
        concatenate(
          { target: targetPath, source: scriptPath, type: PREPEND_JS_TYPE },
          tempDir,
          targetPath,
          buffer,
        ),
      ).toThrow('Provided script file does not exist');
    });

    it('returns the original buffer when the path does not match the target', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jscrambler-cli-'));
      const targetPath = path.join(tempDir, 'target.js');
      const otherPath = path.join(tempDir, 'other.js');
      const scriptPath = path.join(tempDir, 'script.js');
      fs.writeFileSync(scriptPath, 'console.log("script");');

      const buffer = Buffer.from('console.log("target");', 'utf-8');
      const result = concatenate(
        { target: targetPath, source: scriptPath, type: PREPEND_JS_TYPE },
        tempDir,
        otherPath,
        buffer,
      );

      expect(result).toBe(buffer);
      expect(result.toString('utf-8')).toBe('console.log("target");');
    });
  });
});
