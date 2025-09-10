import fs from 'fs';
import { glob } from 'glob';
import filesizeParser from 'filesize-parser';

// Unit under test
import {
  getMatchedFiles,
  validateNProtections,
  APPEND_JS_TYPE,
  PREPEND_JS_TYPE,
  concatenate,
  isJavascriptFile,
  validateThresholdFn,
} from '../src/utils';

jest.mock('glob', () => ({
  glob: { sync: jest.fn() }
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  readFileSync: jest.fn(),
}));

jest.mock('filesize-parser', () => jest.fn());

describe('utils.js', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getMatchedFiles', () => {
    it('returns matches from glob.sync when there are matches', () => {
      glob.sync.mockReturnValue(['a.js', 'b.js']);
      const res = getMatchedFiles('**/*.js');
      expect(glob.sync).toHaveBeenCalledWith('**/*.js', { dot: true });
      expect(res).toEqual(['a.js', 'b.js']);
    });

    it('falls back to direct path when glob finds nothing and file exists', () => {
      glob.sync.mockReturnValue([]);
      fs.existsSync.mockReturnValue(true);
      const res = getMatchedFiles('assets/[id]-1234.js');
      expect(res).toEqual(['assets/[id]-1234.js']);
    });

    it('returns empty list when no glob matches and file does not exist', () => {
      glob.sync.mockReturnValue([]);
      fs.existsSync.mockReturnValue(false);
      const res = getMatchedFiles('missing.js');
      expect(res).toEqual([]);
    });
  });

  describe('validateNProtections', () => {
    const origExit = process.exit;
    const origError = console.error;

    beforeEach(() => {
      // @ts-ignore
      process.exit = jest.fn();
      console.error = jest.fn();
    });

    afterEach(() => {
      process.exit = origExit;
      console.error = origError;
    });

    it('returns undefined when input is undefined', () => {
      expect(validateNProtections(undefined)).toBeUndefined();
    });

    it('parses valid integer strings', () => {
      expect(validateNProtections('3')).toBe(3);
    });

    it('accepts integer numbers', () => {
      expect(validateNProtections(5)).toBe(5);
    });

    it('exits for non-integer numeric strings', () => {
      validateNProtections('3.5');
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    it('exits for NaN and values < 1', () => {
      validateNProtections('abc');
      expect(process.exit).toHaveBeenCalledWith(1);
      validateNProtections('0');
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });

  describe('concatenate', () => {
    const cwd = process.cwd();
    const path = 'dist/app.js';
    const initialBuffer = Buffer.from('TARGET', 'utf-8');

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
    });

    it('does nothing when provided target does not match current path', () => {
      const scriptObj = {
        target: 'dist/other.js',
        source: 'scripts/helper.js',
        type: APPEND_JS_TYPE,
      };
      const res = concatenate(scriptObj, cwd, path, initialBuffer);
      expect(res.toString('utf-8')).toBe('TARGET');
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('appends script content when type is append-js', () => {
      const scriptObj = {
        target: path,
        source: 'scripts/helper.js',
        type: APPEND_JS_TYPE,
      };
      fs.readFileSync.mockReturnValue(Buffer.from('SCRIPT', 'utf-8'));
      const res = concatenate(scriptObj, cwd, path, initialBuffer);
      expect(res.toString('utf-8')).toBe('TARGET\nSCRIPT');
    });

    it('prepends script content when type is prepend-js', () => {
      const scriptObj = {
        target: path,
        source: 'scripts/helper.js',
        type: PREPEND_JS_TYPE,
      };
      fs.readFileSync.mockReturnValue(Buffer.from('SCRIPT', 'utf-8'));
      const res = concatenate(scriptObj, cwd, path, initialBuffer);
      expect(res.toString('utf-8')).toBe('SCRIPT\nTARGET');
    });

    it('throws error when source file does not exist', () => {
      const scriptObj = {
        target: path,
        source: 'scripts/missing.js',
        type: APPEND_JS_TYPE,
      };
      fs.existsSync.mockReturnValueOnce(false); // for source
      expect(() => concatenate(scriptObj, cwd, path, initialBuffer)).toThrow('Provided script file does not exist');
    });
  });

  describe('isJavascriptFile', () => {
    it('returns true for .js, .mjs and .cjs', () => {
      expect(isJavascriptFile('a.js')).toBe(true);
      expect(isJavascriptFile('a.mjs')).toBe(true);
      expect(isJavascriptFile('a.cjs')).toBe(true);
    });

    it('returns false for other extensions', () => {
      expect(isJavascriptFile('a.ts')).toBe(false);
      expect(isJavascriptFile('a.jsx')).toBe(false);
      expect(isJavascriptFile('a')).toBe(false);
    });
  });

  describe('validateThresholdFn', () => {
    const origExit = process.exit;
    const origError = console.error;

    beforeEach(() => {
      // @ts-ignore
      process.exit = jest.fn();
      console.error = jest.fn();
    });

    afterEach(() => {
      process.exit = origExit;
      console.error = origError;
    });

    it('returns byte value when valid threshold is provided', () => {
      filesizeParser.mockReturnValue(204800); // 200kb
      const parseFn = validateThresholdFn('max-upload-size');
      expect(parseFn('200kb')).toBe(204800);
      expect(filesizeParser).toHaveBeenCalledWith('200kb');
    });

    it('exits the process when invalid threshold is provided', () => {
      filesizeParser.mockImplementation(() => { throw new Error('Invalid'); });
      const parseFn = validateThresholdFn('max-upload-size');
      parseFn('invalid');
      expect(console.error).toHaveBeenCalled();
      expect(process.exit).toHaveBeenCalledWith(1);
    });
  });
});
