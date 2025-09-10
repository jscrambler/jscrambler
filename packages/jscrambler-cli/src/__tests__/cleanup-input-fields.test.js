import { jest } from '@jest/globals';
import cleanupInputFields from '../cleanup-input-fields';

describe('cleanup-input-fields', () => {
  let consoleWarnSpy;

  beforeEach(() => {
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('cleanupInputFields', () => {
    it('should return options and fragments unchanged when all fields are supported', () => {
      const args = [{
        name: 'data',
        type: {
          inputFields: [
            { name: 'tolerateMinification' },
            { name: 'useProfilingData' },
            { name: 'useAppClassification' }
          ]
        }
      }];
      
      const fragments = 'tolerateMinification, useProfilingData, useAppClassification';
      const options = {
        tolerateMinification: true,
        useProfilingData: false,
        useAppClassification: true
      };

      const [cleanedOptions, cleanedFragments] = cleanupInputFields(args, fragments, options);

      expect(cleanedOptions).toEqual(options);
      expect(cleanedFragments).toBe(fragments);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should clean up unsupported field and warn', () => {
      const args = [{
        name: 'data',
        type: {
          inputFields: [
            { name: 'useProfilingData' }
          ]
        }
      }];
      
      const fragments = 'tolerateMinification, useProfilingData';
      const options = {
        tolerateMinification: true,
        useProfilingData: false
      };

      const [cleanedOptions, cleanedFragments] = cleanupInputFields(args, fragments, options);

      expect(cleanedOptions.tolerateMinification).toBeUndefined();
      expect(cleanedOptions.useProfilingData).toBe(false);
      expect(cleanedFragments).toContain('useProfilingData');
      expect(cleanedFragments).not.toContain('tolerateMinification');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'This API Version does not support the tolerateMinification argument.'
      );
    });

    it('should handle multiple unsupported fields', () => {
      const args = [{
        name: 'data',
        type: {
          inputFields: []
        }
      }];
      
      const fragments = 'tolerateMinification,\n  useProfilingData,\n  inputSymbolTable';
      const options = {
        tolerateMinification: true,
        useProfilingData: false,
        inputSymbolTable: 'symbols.json'
      };

      const [cleanedOptions, cleanedFragments] = cleanupInputFields(args, fragments, options);

      expect(cleanedOptions.tolerateMinification).toBeUndefined();
      expect(cleanedOptions.useProfilingData).toBeUndefined();
      expect(cleanedOptions.inputSymbolTable).toBeUndefined();
      // The fragments are replaced but commas may remain
      expect(cleanedFragments.replace(/,|\s/g, '')).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalledTimes(3);
    });

    it('should handle fragments with various formatting', () => {
      const args = [{
        name: 'data',
        type: {
          inputFields: [
            { name: 'entryPoint' }
          ]
        }
      }];
      
      const fragments = `
        tolerateMinification,
        useProfilingData,
        entryPoint,
        inputSymbolTable
      `;
      const options = {
        tolerateMinification: true,
        useProfilingData: false,
        entryPoint: 'main.js',
        inputSymbolTable: 'symbols.json'
      };

      const [cleanedOptions, cleanedFragments] = cleanupInputFields(args, fragments, options);

      expect(cleanedOptions.entryPoint).toBe('main.js');
      expect(cleanedOptions.tolerateMinification).toBeUndefined();
      expect(cleanedOptions.useProfilingData).toBeUndefined();
      expect(cleanedOptions.inputSymbolTable).toBeUndefined();
      expect(cleanedFragments).toContain('entryPoint');
    });

    it('should not clean up fields that are not in the options', () => {
      const args = [{
        name: 'data',
        type: {
          inputFields: []
        }
      }];
      
      const fragments = 'someField, anotherField';
      const options = {
        someField: 'value'
      };

      const [cleanedOptions, cleanedFragments] = cleanupInputFields(args, fragments, options);

      expect(cleanedOptions.someField).toBe('value');
      expect(cleanedFragments).toBe(fragments);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should handle missing data argument gracefully', () => {
      const args = [{
        name: 'otherArg',
        type: {}
      }];
      
      const fragments = 'tolerateMinification';
      const options = {
        tolerateMinification: true
      };

      const [cleanedOptions, cleanedFragments] = cleanupInputFields(args, fragments, options);

      expect(cleanedOptions.tolerateMinification).toBeUndefined();
      expect(cleanedFragments).toBe('');
      expect(consoleWarnSpy).toHaveBeenCalled();
    });

    it('should check all predefined fields for cleanup', () => {
      const args = [{
        name: 'data',
        type: {
          inputFields: []
        }
      }];
      
      const fragments = `
        tolerateMinification,
        useProfilingData,
        useAppClassification,
        inputSymbolTable,
        entryPoint,
        ensureCodeAnnotation,
        generateAlias
      `;
      const options = {
        tolerateMinification: true,
        useProfilingData: false,
        useAppClassification: true,
        inputSymbolTable: 'symbols.json',
        entryPoint: 'main.js',
        ensureCodeAnnotation: true,
        generateAlias: false
      };

      const [cleanedOptions, cleanedFragments] = cleanupInputFields(args, fragments, options);

      expect(cleanedOptions.tolerateMinification).toBeUndefined();
      expect(cleanedOptions.useProfilingData).toBeUndefined();
      expect(cleanedOptions.useAppClassification).toBeUndefined();
      expect(cleanedOptions.inputSymbolTable).toBeUndefined();
      expect(cleanedOptions.entryPoint).toBeUndefined();
      expect(cleanedOptions.ensureCodeAnnotation).toBeUndefined();
      expect(cleanedOptions.generateAlias).toBeUndefined();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(7);
    });

    it('should handle empty options object', () => {
      const args = [{
        name: 'data',
        type: {
          inputFields: []
        }
      }];
      
      const fragments = 'tolerateMinification';
      const options = {};

      const [cleanedOptions, cleanedFragments] = cleanupInputFields(args, fragments, options);

      expect(cleanedOptions).toEqual({});
      expect(cleanedFragments).toBe(fragments);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });

    it('should preserve fields with undefined values if they are supported', () => {
      const args = [{
        name: 'data',
        type: {
          inputFields: [
            { name: 'tolerateMinification' }
          ]
        }
      }];
      
      const fragments = 'tolerateMinification';
      const options = {
        tolerateMinification: undefined
      };

      const [cleanedOptions, cleanedFragments] = cleanupInputFields(args, fragments, options);

      expect(cleanedOptions).toEqual(options);
      expect(cleanedFragments).toBe(fragments);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    });
  });
});