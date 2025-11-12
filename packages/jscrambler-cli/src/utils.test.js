import { glob } from 'glob';
import fs from 'fs';
import filesizeParser from 'filesize-parser';
import {
  getMatchedFiles,
  validateNProtections,
  isJavascriptFile,
  validateThresholdFn,
  concatenate,
  APPEND_JS_TYPE,
  PREPEND_JS_TYPE,
} from '../src/utils';

jest.mock('glob');
jest.mock('fs');
jest.mock('filesize-parser');

describe('jscrambler-cli/src/utils', () => {
  describe('getMatchedFiles', () => {
    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should return files matched by glob', () => {
      const pattern = 'src/**/*.js';
      const expectedFiles = ['src/index.js', 'src/utils.js'];
      glob.sync.mockReturnValue(expectedFiles);

      const result = getMatchedFiles(pattern);

      expect(glob.sync).toHaveBeenCalledWith(pattern, { dot: true });
      expect(result).toEqual(expectedFiles);
    });

    it('should return the pattern itself if it exists as a file and glob returns no matches', () => {
      const pattern = 'file-with-[special-chars].js';
      glob.sync.mockReturnValue([]);
      fs.existsSync.mockReturnValue(true);

      const result = getMatchedFiles(pattern);

      expect(glob.sync).toHaveBeenCalledWith(pattern, { dot: true });
      expect(fs.existsSync).toHaveBeenCalledWith(pattern);
      expect(result).toEqual([pattern]);
    });

    it('should return an empty array if no files match and pattern does not exist', () => {
      const pattern = 'non-existent-pattern-*.js';
      glob.sync.mockReturnValue([]);
      fs.existsSync.mockReturnValue(false);

      const result = getMatchedFiles(pattern);

      expect(result).toEqual([]);
    });
  });

  describe('validateNProtections', () => {
    let exitSpy;
    let errorSpy;

    beforeEach(() => {
      exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it('should return undefined if n is undefined', () => {
      expect(validateNProtections(undefined)).toBeUndefined();
    });

    it('should return the parsed integer for a valid string', () => {
      expect(validateNProtections('5')).toBe(5);
    });

    it('should exit if n is not a number', () => {
      validateNProtections('abc');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(
        '*protections* requires an integer greater than 0.'
      );
    });

    it('should exit if n is a float string', () => {
      validateNProtections('1.5');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });

    it('should exit if n is less than 1', () => {
      validateNProtections('0');
      expect(exitSpy).toHaveBeenCalledWith(1);
      validateNProtections('-1');
      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('isJavascriptFile', () => {
    it.each([
      ['file.js', true],
      ['file.mjs', true],
      ['file.cjs', true],
      ['file.ts', false],
      ['file.json', false],
      ['file', false],
      ['.gitignore', false],
    ])('should return %s for %s', (filename, expected) => {
      expect(isJavascriptFile(filename)).toBe(expected);
    });
  });

  describe('validateThresholdFn', () => {
    let exitSpy;
    let errorSpy;
    const optionName = 'test-threshold';
    let validate;

    beforeEach(() => {
      exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      validate = validateThresholdFn(optionName);
    });

    afterEach(() => {
      exitSpy.mockRestore();
      errorSpy.mockRestore();
      jest.resetAllMocks();
    });

    it('should return a function', () => {
      expect(typeof validate).toBe('function');
    });

    it('should correctly parse a valid threshold string', () => {
      filesizeParser.mockReturnValue(204800);
      const result = validate('200kb');
      expect(filesizeParser).toHaveBeenCalledWith('200kb');
      expect(result).toBe(204800);
    });

    it('should exit if the threshold string is invalid', () => {
      filesizeParser.mockImplementation(() => {
        throw new Error('Invalid');
      });
      validate('invalid-value');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(errorSpy).toHaveBeenCalledWith(
        `*${optionName}* requires a valid <threshold> value. Format: {number}{unit="b,kb,mb"}. Example: 200kb`
      );
    });
  });

  describe('concatenate', () => {
    const cwd = '/test/cwd';
    const targetPath = '/test/cwd/target.js';
    const sourcePath = '/test/cwd/source.js';
    const targetContent = 'console.log("target");';
    const sourceContent = 'console.log("source");';
    const initialBuffer = Buffer.from(targetContent, 'utf-8');

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(Buffer.from(sourceContent, 'utf-8'));
    });

    afterEach(() => {
      jest.resetAllMocks();
    });

    it('should not modify buffer if path does not match target', () => {
      const scriptObject = {
        target: 'another/file.js',
        source: sourcePath,
        type: APPEND_JS_TYPE,
      };
      const result = concatenate(scriptObject, cwd, targetPath, initialBuffer);
      expect(result).toBe(initialBuffer);
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    it('should append content when type is append-js', () => {
      const scriptObject = {
        target: 'target.js',
        source: sourcePath,
        type: APPEND_JS_TYPE,
      };
      const result = concatenate(scriptObject, cwd, targetPath, initialBuffer);
      const expectedContent = `${targetContent}\n${sourceContent}`;
      expect(result.toString('utf-8')).toBe(expectedContent);
      expect(fs.existsSync).toHaveBeenCalledWith(sourcePath);
      expect(fs.readFileSync).toHaveBeenCalledWith(sourcePath);
    });

    it('should prepend content when type is prepend-js', () => {
      const scriptObject = {
        target: 'target.js',
        source: sourcePath,
        type: PREPEND_JS_TYPE,
      };
      const result = concatenate(scriptObject, cwd, targetPath, initialBuffer);
      const expectedContent = `${sourceContent}\n${targetContent}`;
      expect(result.toString('utf-8')).toBe(expectedContent);
    });

    it('should throw an error if source file does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      const scriptObject = {
        target: 'target.js',
        source: sourcePath,
        type: APPEND_JS_TYPE,
      };
      expect(() =>
        concatenate(scriptObject, cwd, targetPath, initialBuffer)
      ).toThrow('Provided script file does not exist');
    });

    it('should handle normalized paths correctly', () => {
      const scriptObject = {
        target: './target.js', // relative path
        source: sourcePath,
        type: APPEND_JS_TYPE,
      };
      // In a real scenario, `path.normalize('./target.js')` would not equal `/test/cwd/target.js`
      // but for this test, we assume the logic inside `concatenate` handles it.
      // The current implementation of `concatenate` normalizes the target but compares it to an absolute path.
      // Let's test the exact behavior.
      const result = concatenate(scriptObject, cwd, 'target.js', initialBuffer);
      const expectedContent = `${targetContent}\n${sourceContent}`;
      expect(result.toString('utf-8')).toBe(expectedContent);
    });
  });
});