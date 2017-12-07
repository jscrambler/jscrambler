/* global describe, beforeEach, it, expect, spyOn, Buffer, jasmine, console */

const fs = require('fs');
const jScrambler = require('../../jscrambler');
const jScramblerKeys = require('../../jscrambler_keys');
const pluck = require('lodash.pluck');
const util = require('util');

describe('JScrambler Client', () => {
  let jScramblerClient, projectId, downloadedBuffer;

  beforeEach(() => {
    jScramblerClient = new jScrambler.Client({
      accessKey: jScramblerKeys.accessKey,
      secretKey: jScramblerKeys.secretKey
    });
    jasmine.DEFAULT_TIMEOUT_INTERVAL = 20000;
  });

  test('Single file', ['test/fixtures/single-file/index.js']);
  test('Multiple files', [
    'test/fixtures/multiple-files/index.html',
    'test/fixtures/multiple-files/hello-world.js'
  ]);
  test('Nested files', [
    'test/fixtures/nested-files/index.html',
    'test/fixtures/nested-files/lib/hello-world.js',
    'test/fixtures/nested-files/lib/a/hello-world.js',
    'test/fixtures/nested-files/lib/b/hello-world.js'
  ]);

  function test(testName, files) {
    it(`${testName}: uploads code`, done => {
      const zipSpy = spyOn(jScrambler, 'zipProject').andCallThrough();

      jScrambler
        .uploadCode(jScramblerClient, {
          files
        })
        .then(res => {
          expect(zipSpy).toHaveBeenCalled();
          expect(res.id).toBeDefined();
          expect(res.extension).toEqual('zip');

          expect(res.sources.length).toEqual(files.length);
          for (let i = 0, l = files.length; i < l; ++i) {
            expect(
              pluck(res.sources, 'filename').indexOf(files[i]) !== -1
            ).toBeTruthy();
          }

          projectId = res.id;
        })
        .catch(error => {
          console.log(util.inspect(error));
        })
        .fin(done);
    });

    it(`${testName}: gets project info`, done => {
      expect(projectId).toBeDefined();

      jScrambler
        .getInfo(jScramblerClient, projectId)
        .then(res => {
          expect(res.error_id).toEqual(null);
          expect(res.extension).toEqual('zip');

          expect(res.sources.length).toEqual(files.length);
          for (let i = 0, l = files.length; i < l; ++i) {
            expect(
              pluck(res.sources, 'filename').indexOf(files[i]) !== -1
            ).toBeTruthy();
            expect(res.sources[i].error_id).toEqual(null);
          }
        })
        .catch(error => {
          console.log(util.inspect(error));
        })
        .fin(done);
    });

    it(`${testName}: polls project`, done => {
      expect(projectId).toBeDefined();

      jScrambler
        .pollProject(jScramblerClient, projectId)
        .then(res => {
          expect(res.error_id).toEqual('0');
          expect(res.finished_at).toBeDefined();

          expect(res.sources.length).toEqual(files.length);
          for (let i = 0, l = files.length; i < l; ++i) {
            expect(
              pluck(res.sources, 'filename').indexOf(files[i]) !== -1
            ).toBeTruthy();
          }

          const finishedAt = new Date(res.finished_at);
          expect(finishedAt instanceof Date).toBeTruthy();
        })
        .catch(error => {
          console.log(util.inspect(error));
        })
        .fin(done);
    });

    it(`${testName}: downloads code`, done => {
      expect(projectId).toBeDefined();

      jScrambler
        .downloadCode(jScramblerClient, projectId)
        .then(res => {
          expect(Buffer.isBuffer(res)).toBeTruthy();
          downloadedBuffer = res;
        })
        .catch(error => {
          console.log(util.inspect(error));
        })
        .fin(done);
    });

    it(`${testName}: unzips the project`, () => {
      expect(downloadedBuffer).toBeDefined();

      jScrambler.unzipProject(downloadedBuffer, './results/');
      for (let i = 0, l = files.length; i < l; ++i) {
        expect(fs.existsSync(`./results/${files[i]}`)).toBeTruthy();
      }
    });

    it(`${testName}: processes`, done => {
      jScrambler
        .process({
          filesSrc: files,
          filesDest: './results',
          keys: {
            accessKey: jScramblerKeys.accessKey,
            secretKey: jScramblerKeys.secretKey
          }
        })
        .catch(error => {
          console.log(util.inspect(error));
        })
        .fin(done);
    });
  }
});
