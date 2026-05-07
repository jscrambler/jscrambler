'use strict';

const assert = require('assert');
const client = require('jscrambler').default;

const originalProtectAndDownload = client.protectAndDownload;
const originalConfig = client.config;

client.config = Object.assign({}, client.config, {
  instrument: false,
  sourceMaps: false
});

const JscramblerPlugin = require('../src/index');

function asset(content) {
  return {
    source() {
      return content;
    },
    size() {
      return content.length;
    }
  };
}

async function collectProtectedFiles() {
  let protectedFilenames = [];

  client.protectAndDownload = (options, callback) => {
    protectedFilenames = options.sources.map(({filename}) => filename);
    callback(options.sources.map(({filename}) => ({
      filename,
      content: `protected:${filename}`
    })));

    return 'protection-id';
  };

  const plugin = new JscramblerPlugin({obfuscationHook: 'emit'});
  let emitHandler;

  plugin.apply({
    plugin(name, handler) {
      assert.strictEqual(name, 'emit');
      emitHandler = handler;
    }
  });

  const compilation = {
    assets: {
      'app.js': asset('js'),
      'app.mjs': asset('mjs'),
      'app.cjs': asset('cjs'),
      'index.html': asset('html'),
      'partial.htm': asset('htm'),
      'styles.css': asset('css'),
      'app.mjs.map': asset('map')
    },
    chunks: [
      {
        files: [
          'app.js',
          'app.mjs',
          'app.cjs',
          'index.html',
          'partial.htm',
          'styles.css',
          'app.mjs.map'
        ]
      }
    ]
  };

  await new Promise((resolve, reject) => {
    emitHandler(compilation, (err) => {
      if (err) {
        reject(err);
        return;
      }

      resolve();
    });
  });

  return {plugin, protectedFilenames};
}

(async () => {
  try {
    const {plugin, protectedFilenames} = await collectProtectedFiles();

    assert.deepStrictEqual(protectedFilenames, [
      'app.js',
      'app.mjs',
      'app.cjs',
      'index.html',
      'partial.htm'
    ]);

    const mapCompilation = {
      assets: {
        'app.mjs.map': asset('mjs map'),
        'app.cjs.map': asset('cjs map')
      }
    };

    assert.strictEqual(
      plugin.getSourceMapInfo('app.mjs.map', mapCompilation).sourceMapFilename,
      'app.mjs.map'
    );
    assert.strictEqual(
      plugin.getSourceMapInfo('app.cjs.map', mapCompilation).sourceMapFilename,
      'app.cjs.map'
    );
  } finally {
    client.protectAndDownload = originalProtectAndDownload;
    client.config = originalConfig;
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
