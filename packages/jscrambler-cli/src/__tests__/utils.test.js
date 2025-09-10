import { jest } from '@jest/globals';
import fs from 'fs';
import { glob } from 'glob';
import {
  getMatchedFiles,
  validateNProtections,
  concatenate,
  isJavascriptFile,
  validateThresholdFn,
  APPEND_JS_TYPE,
  PREPEND_JS_TYPE
} from '../utils';

jest.mock('glob');
jest.mock('fs');

describe('utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getMatchedFiles', () => {
    it('should return matched files for a glob pattern', () => {
      const mockFiles = ['file1.js', 'file2.js'];
      glob.sync.mockReturnValue(mockFiles);

      const result = getMatchedFiles('*.js');

      expect(glob.sync).toHaveBeenCalledWith('*.js', { dot: true });
      expect(result).toEqual(mockFiles);
    });

    it('should return file if no glob matches but file exists', () => {
      glob.sync.mockReturnValue([]);
      fs.existsSync.mockReturnValue(true);

      const result = getMatchedFiles('[id]-1234.js');

      expect(fs.existsSync).toHaveBeenCalledWith('[id]-1234.js');
      expect(result).toEqual(['[id]-1234.js']);
    });

    it('should return empty array if no matches and file does not exist', () => {
      glob.sync.mockReturnValue([]);
      fs.existsSync.mockReturnValue(false);

      const result = getMatchedFiles('nonexistent.js');

      expect(result).toEqual([]);
    });
  });

  describe('validateNProtections', () => {
    it('should return undefined if n is undefined', () => {
      expect(validateNProtections(undefined)).toBeUndefined();
    });

    it('should return valid integer', () => {
      expect(validateNProtections('5')).toBe(5);
      expect(validateNProtections(10)).toBe(10);
    });

    it('should exit on invalid input - NaN', () => {
      validateNProtections('abc');
      
      expect(console.error).toHaveBeenCalledWith(
        '*protections* requires an integer greater than 0.'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit on invalid input - zero', () => {
      validateNProtections(0);
      
      expect(console.error).toHaveBeenCalledWith(
        '*protections* requires an integer greater than 0.'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit on invalid input - negative', () => {
      validateNProtections(-5);
      
      expect(console.error).toHaveBeenCalledWith(
        '*protections* requires an integer greater than 0.'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit on invalid input - float', () => {
      validateNProtections('5.5');
      
      expect(console.error).toHaveBeenCalledWith(
        '*protections* requires an integer greater than 0.'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('concatenate', () => {
    it('should append script content to target file', () => {
      const scriptObject = {
        target: '/path/to/target.js',
        source: '/path/to/script.js',
        type: APPEND_JS_TYPE
      };
      const buffer = Buffer.from('target content', 'utf-8');
      const scriptContent = Buffer.from('script content', 'utf-8');

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(scriptContent);

      const result = concatenate(scriptObject, '/cwd', '/path/to/target.js', buffer);

      expect(fs.existsSync).toHaveBeenCalledWith('/path/to/script.js');
      expect(result.toString('utf-8')).toBe('target content\nscript content');
    });

    it('should prepend script content to target file', () => {
      const scriptObject = {
        target: '/path/to/target.js',
        source: '/path/to/script.js',
        type: PREPEND_JS_TYPE
      };
      const buffer = Buffer.from('target content', 'utf-8');
      const scriptContent = Buffer.from('script content', 'utf-8');

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(scriptContent);

      const result = concatenate(scriptObject, '/cwd', '/path/to/target.js', buffer);

      expect(result.toString('utf-8')).toBe('script content\ntarget content');
    });

    it('should return original buffer if path does not match target', () => {
      const scriptObject = {
        target: '/path/to/other.js',
        source: '/path/to/script.js',
        type: APPEND_JS_TYPE
      };
      const buffer = Buffer.from('original content', 'utf-8');

      const result = concatenate(scriptObject, '/cwd', '/path/to/target.js', buffer);

      expect(result).toBe(buffer);
      expect(fs.existsSync).not.toHaveBeenCalled();
    });

    it('should throw error if source file does not exist', () => {
      const scriptObject = {
        target: '/path/to/target.js',
        source: '/path/to/nonexistent.js',
        type: APPEND_JS_TYPE
      };
      const buffer = Buffer.from('target content', 'utf-8');

      fs.existsSync.mockReturnValue(false);

      expect(() => {
        concatenate(scriptObject, '/cwd', '/path/to/target.js', buffer);
      }).toThrow('Provided script file does not exist');
    });
  });

  describe('isJavascriptFile', () => {
    it('should return true for .js files', () => {
      expect(isJavascriptFile('file.js')).toBe(true);
      expect(isJavascriptFile('/path/to/file.js')).toBe(true);
    });

    it('should return true for .mjs files', () => {
      expect(isJavascriptFile('file.mjs')).toBe(true);
      expect(isJavascriptFile('/path/to/file.mjs')).toBe(true);
    });

    it('should return true for .cjs files', () => {
      expect(isJavascriptFile('file.cjs')).toBe(true);
      expect(isJavascriptFile('/path/to/file.cjs')).toBe(true);
    });

    it('should return false for non-javascript files', () => {
      expect(isJavascriptFile('file.txt')).toBe(false);
      expect(isJavascriptFile('file.json')).toBe(false);
      expect(isJavascriptFile('file.ts')).toBe(false);
      expect(isJavascriptFile('file')).toBe(false);
    });
  });

  describe('validateThresholdFn', () => {
    it('should parse valid byte values', () => {
      const validator = validateThresholdFn('maxSize');
      
      expect(validator('100')).toBe(100);
      // 100b in filesize-parser is 100 bits = 12.5 bytes = 13 when rounded
      expect(validator('100b')).toBe(13);
    });

    it('should parse valid kilobyte values', () => {
      const validator = validateThresholdFn('maxSize');
      
      expect(validator('1kb')).toBe(1024);
      expect(validator('10kb')).toBe(10240);
    });

    it('should parse valid megabyte values', () => {
      const validator = validateThresholdFn('maxSize');
      
      expect(validator('1mb')).toBe(1048576);
      expect(validator('5mb')).toBe(5242880);
    });

    it('should exit on invalid threshold value', () => {
      const validator = validateThresholdFn('maxSize');
      
      validator('invalid');

      expect(console.error).toHaveBeenCalledWith(
        '*maxSize* requires a valid <threshold> value. Format: {number}{unit="b,kb,mb"}. Example: 200kb'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('should exit on invalid unit', () => {
      const validator = validateThresholdFn('minSize');
      
      // GB is valid in filesize-parser, test with invalid unit instead
      validator('100xyz');

      expect(console.error).toHaveBeenCalledWith(
        '*minSize* requires a valid <threshold> value. Format: {number}{unit="b,kb,mb"}. Example: 200kb'
      );
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});