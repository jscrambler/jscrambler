import { zipSources, unzip } from '../src/zip';

function makeSources() {
  return [
    { filename: 'a.txt', content: 'Hello' },
    { filename: 'b/nested.txt', content: 'World' },
  ];
}

describe('zip utilities', () => {
  test('zipSources should include provided files', async () => {
    const sources = makeSources();
    const zip = await zipSources(sources);

    const fileNames = Object.keys(zip.files);
    expect(fileNames.sort()).toEqual(['a.txt', 'b/', 'b/nested.txt']);
  });

  test('unzip should extract entries and provide contents when stream=false', async () => {
    const sources = makeSources();
    const zip = await zipSources(sources);
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    const results = await new Promise(async (resolve) => {
      await unzip(buffer, (entries) => resolve(entries), false);
    });

    // Expect both files with correct contents
    const map = Object.fromEntries(results.map(r => [r.filename, r.content]));
    expect(Buffer.isBuffer(map['a.txt'])).toBe(false); // unzip returns string when stream=false
    expect(map['a.txt']).toBe('Hello');
    expect(map['b/nested.txt']).toBe('World');
  });
});
