jest.mock(
  'metro-source-map',
  () => {
    const toString = jest.fn(() => 'MOCK_SOURCEMAP');
    return {
      fromRawMappings: jest.fn(() => ({ toString })),
      __private: { toString },
    };
  },
  { virtual: true },
);

const metroSourceMap = require('metro-source-map');
const {
  JSCRAMBLER_BEG_ANNOTATION,
  JSCRAMBLER_END_ANNOTATION,
  HERMES_SHOW_SOURCE_DIRECTIVE,
  JSCRAMBLER_ANTI_TAMPERING,
  JSCRAMBLER_ANTI_TAMPERING_MODE_RCK,
  JSCRAMBLER_ANTI_TAMPERING_MODE_SKL,
  JSCRAMBLER_GLOBAL_VARIABLE_INDIRECTION,
  JSCRAMBLER_SELF_DEFENDING,
} = require('../lib/constants');

const utils = require('../lib/utils');

function withPatchedProcess({ argv, env }, fn) {
  const originalArgv = process.argv;
  const originalEnvPatch = env ? Object.keys(env).reduce((acc, key) => {
    acc[key] = Object.prototype.hasOwnProperty.call(process.env, key)
      ? process.env[key]
      : Symbol.for('ENV_UNSET');
    return acc;
  }, {}) : null;
  try {
    if (argv) process.argv = argv;
    if (env) {
      for (const [key, value] of Object.entries(env)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = String(value);
        }
      }
    }
    return fn();
  } finally {
    process.argv = originalArgv;
    if (originalEnvPatch) {
      for (const [key, prev] of Object.entries(originalEnvPatch)) {
        if (prev === Symbol.for('ENV_UNSET')) {
          delete process.env[key];
        } else {
          process.env[key] = prev;
        }
      }
    }
  }
}

describe('jscrambler-metro-plugin utils', () => {
  test('stripJscramblerTags removes beg/end annotations', () => {
    const code = `a;${JSCRAMBLER_BEG_ANNOTATION}b;${JSCRAMBLER_END_ANNOTATION}c;`;
    expect(utils.stripJscramblerTags(code)).toBe('a;b;c;');
  });

  test('wrapCodeWithTags is idempotent when tags already exist', () => {
    const code = `{${JSCRAMBLER_BEG_ANNOTATION}x${JSCRAMBLER_END_ANNOTATION}}`;
    expect(utils.wrapCodeWithTags(code)).toBe(code);
  });

  test('wrapCodeWithTags inserts tags inside braces and skips initial newline', () => {
    const code = `{\nconsole.log("x");\n}`;
    const wrapped = utils.wrapCodeWithTags(code);
    expect(wrapped).toContain(JSCRAMBLER_BEG_ANNOTATION);
    expect(wrapped).toContain(JSCRAMBLER_END_ANNOTATION);
    expect(wrapped.indexOf(JSCRAMBLER_BEG_ANNOTATION)).toBe(code.indexOf('{') + 2); // "{\n"
  });

  test('extractLocs returns line/column for beg/end annotations', async () => {
    const input = [
      'first line',
      `  ${JSCRAMBLER_BEG_ANNOTATION} something`,
      'middle line',
      `  ${JSCRAMBLER_END_ANNOTATION}`,
      'last line',
    ].join('\n');

    const locs = await utils.extractLocs(input);
    expect(locs).toHaveLength(1);
    expect(locs[0]).toMatchObject({
      lineStart: 2,
      lineEnd: 4,
      startAtFirstColumn: false,
    });
    expect(locs[0].columnStart).toBe(2);
  });

  test('extractLocs adjusts columnStart when Hermes show source directive is present', async () => {
    const input = [
      'first',
      `${JSCRAMBLER_BEG_ANNOTATION}${HERMES_SHOW_SOURCE_DIRECTIVE} rest`,
      JSCRAMBLER_END_ANNOTATION,
    ].join('\n');

    const locs = await utils.extractLocs(input);
    expect(locs).toHaveLength(1);
    expect(locs[0].columnStart).toBe(HERMES_SHOW_SOURCE_DIRECTIVE.length);
  });

  test('buildNormalizePath returns undefined for invalid path input', () => {
    expect(utils.buildNormalizePath('', '/root/project')).toBeUndefined();
    expect(utils.buildNormalizePath('   ', '/root/project')).toBeUndefined();
    expect(utils.buildNormalizePath(null, '/root/project')).toBeUndefined();
  });

  test('buildNormalizePath strips projectRoot, normalizes extension to .js, and removes leading separator', () => {
    const projectRoot = '/root/project';
    const fullPath = '/root/project/App/index.tsx';
    expect(utils.buildNormalizePath(fullPath, projectRoot)).toBe('App/index.js');
  });

  test('stripEntryPointTags restores original entrypoint body', () => {
    const entryPointMinified = '__d(function(){console.log(1)});';
    const entryPointBody = '{console.log(1)}';
    const entryPointBodyWithTags = utils.wrapCodeWithTags(entryPointBody);
    const metroBundle = `AAA${entryPointBodyWithTags}BBB`;
    expect(utils.stripEntryPointTags(metroBundle, entryPointMinified)).toBe(
      `AAA${entryPointBody}BBB`,
    );
  });

  test('buildModuleSourceMap delegates to metro-source-map fromRawMappings/toString', () => {
    const output = { code: 'x', map: [[0, 0, 0, 0]] };
    const modulePath = 'App/index.js';
    const source = 'console.log(1)';
    const result = utils.buildModuleSourceMap(output, modulePath, source);

    expect(metroSourceMap.fromRawMappings).toHaveBeenCalledTimes(1);
    const arg = metroSourceMap.fromRawMappings.mock.calls[0][0];
    expect(arg[0]).toMatchObject({ code: output.code, map: output.map, source, path: modulePath });
    expect(result).toBe('MOCK_SOURCEMAP');
  });

  test('isFileReadable resolves true/false based on fs.access callback error', async () => {
    const fs = require('fs');
    jest.spyOn(fs, 'access').mockImplementation((_p, _m, cb) => cb(null));
    await expect(utils.isFileReadable('/tmp/ok')).resolves.toBe(true);
    fs.access.mockImplementation((_p, _m, cb) => cb(new Error('nope')));
    await expect(utils.isFileReadable('/tmp/nope')).resolves.toBe(false);
  });

  test('addBundleArgsToExcludeList adds unique args from bundle wrapper', () => {
    const excludeList = ['existing'];
    const chunk = '(g,r,i,a,m,e,d) {';
    utils.addBundleArgsToExcludeList(chunk, excludeList);
    expect(excludeList).toEqual(['existing', 'g', 'r', 'i', 'a', 'm', 'e', 'd']);
  });

  test('addBundleArgsToExcludeList exits when it cannot parse args', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => utils.addBundleArgsToExcludeList('no match', [])).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  test('handleExcludeList sets config.excludeList when supported', () => {
    const config = {};
    utils.handleExcludeList(config, {
      supportsExcludeList: true,
      excludeList: ['a', 'b'],
    });
    expect(config.excludeList).toEqual(['a', 'b']);
  });

  test('handleExcludeList merges excludeList into GVI options when not supported', () => {
    const config = {
      params: [
        {
          name: JSCRAMBLER_GLOBAL_VARIABLE_INDIRECTION,
          options: { excludeList: ['a'] },
        },
      ],
    };
    utils.handleExcludeList(config, {
      supportsExcludeList: false,
      excludeList: ['a', 'b', 'c'],
    });
    const gvi = config.params[0];
    expect(gvi.options.excludeList.sort()).toEqual(['a', 'b', 'c'].sort());
  });

  test('injectTolerateBegninPoisoning adds benign poisoning option once', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const config = {
      params: [
        {
          name: JSCRAMBLER_SELF_DEFENDING,
          options: { options: [] },
        },
      ],
    };
    utils.injectTolerateBegninPoisoning(config);
    utils.injectTolerateBegninPoisoning(config);
    expect(config.params[0].options.options).toHaveLength(1);
    expect(logSpy).toHaveBeenCalled();
  });

  test('handleAntiTampering defaults mode and detects SKL start-at-first-column need', () => {
    const config = {
      enabledHermes: false,
      params: [
        {
          name: JSCRAMBLER_ANTI_TAMPERING,
          options: { mode: [JSCRAMBLER_ANTI_TAMPERING_MODE_SKL] },
        },
      ],
    };
    const processed = `\nX${JSCRAMBLER_BEG_ANNOTATION}`;
    expect(utils.handleAntiTampering(config, processed)).toBe(true);
  });

  test('handleAntiTampering forces RCK when Hermes and SKL is set', () => {
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const config = {
      enabledHermes: true,
      params: [
        {
          name: JSCRAMBLER_ANTI_TAMPERING,
          options: { mode: [JSCRAMBLER_ANTI_TAMPERING_MODE_SKL] },
        },
      ],
    };
    utils.handleAntiTampering(config, '');
    expect(config.params[0].options.mode).toEqual([JSCRAMBLER_ANTI_TAMPERING_MODE_RCK]);
    expect(logSpy).toHaveBeenCalled();
  });

  test('addHermesShowSourceDirective returns true when enabledHermes and hermes directives are selected', () => {
    expect(utils.addHermesShowSourceDirective({ enabledHermes: false, params: [] })).toBe(false);
    expect(
      utils.addHermesShowSourceDirective({
        enabledHermes: true,
        params: [{ name: JSCRAMBLER_ANTI_TAMPERING }],
      }),
    ).toBe(true);
  });

  test('handleHermesIncompatibilities sets codeHardeningThreshold and throws on incompatible params', () => {
    const config = {
      enabledHermes: true,
      params: [{ name: JSCRAMBLER_SELF_DEFENDING }],
    };
    expect(() => utils.handleHermesIncompatibilities(config)).toThrow(/not compatible/i);
    expect(config.codeHardeningThreshold).toBe(999999999);
  });

  test('skipObfuscation: explicit disable', () => {
    expect(utils.skipObfuscation({ enable: false })).toBe('Explicitly Disabled');
  });

  test('skipObfuscation: non-bundle command', () => {
    withPatchedProcess(
      { argv: ['node', 'cli.js', 'start'] },
      () => {
        expect(utils.skipObfuscation({ enable: true })).toBe('Not a *bundle* command');
      },
    );
  });

  test('skipObfuscation: dev mode requires env override', () => {
    withPatchedProcess(
      { argv: ['node', 'cli.js', 'bundle', '--dev', 'true'], env: { JSCRAMBLER_METRO_DEV: undefined } },
      () => {
        expect(utils.skipObfuscation({ enable: true })).toMatch(/Development mode/i);
      },
    );
    withPatchedProcess(
      { argv: ['node', 'cli.js', 'bundle', '--dev', 'true'], env: { JSCRAMBLER_METRO_DEV: 'true' } },
      () => {
        expect(utils.skipObfuscation({ enable: true })).toBeFalsy();
      },
    );
  });

  test('getBundlePath returns paths from argv or exits', () => {
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit');
    });
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    withPatchedProcess(
      { argv: ['node', 'cli.js', '--bundle-output', '/tmp/b.js', '--sourcemap-output', '/tmp/b.map'] },
      () => {
        expect(utils.getBundlePath()).toEqual({
          bundlePath: '/tmp/b.js',
          bundleSourceMapPath: '/tmp/b.map',
        });
      },
    );

    withPatchedProcess({ argv: ['node', 'cli.js'] }, () => {
      expect(() => utils.getBundlePath()).toThrow('process.exit');
    });
    expect(exitSpy).toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
  });
});
