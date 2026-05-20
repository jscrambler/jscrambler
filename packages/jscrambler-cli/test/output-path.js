'use strict';

const assert = require('assert');
const path = require('path');

const jscrambler = require('../dist/index.js').default;

function test(name, fn) {
  try {
    fn();
    process.stdout.write(`ok - ${name}\n`);
  } catch (error) {
    process.stderr.write(`not ok - ${name}\n`);
    throw error;
  }
}

const outputRoot = path.join(__dirname, 'output');

test('resolves safe filenames inside the output directory', function () {
  assert.strictEqual(
    jscrambler.resolveOutputPath(outputRoot, 'assets/app.js'),
    path.resolve(outputRoot, 'assets/app.js')
  );
});

test('allows normalized paths that stay inside the output directory', function () {
  assert.strictEqual(
    jscrambler.resolveOutputPath(outputRoot, 'assets/../app.js'),
    path.resolve(outputRoot, 'app.js')
  );
});

test('rejects resolved paths outside the output directory', function () {
  assert.throws(function () {
    jscrambler.resolveOutputPath(outputRoot, '..');
  }, /outside output directory/);
});

test('rejects resolved paths outside the output directory (full path)', function () {
  assert.throws(function () {
    jscrambler.resolveOutputPath(outputRoot, '/tmp/app.js');
  }, /outside output directory/);
});
