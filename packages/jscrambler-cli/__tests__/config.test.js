import config from '../src/config';

describe('config defaults', () => {
  test('should have expected default values', () => {
    // rc might read user env/rc files, but we pass [] in src/config, so only defaults should be present
    expect(config).toBeDefined();
    expect(config).toHaveProperty('keys');
    expect(config).toHaveProperty('host', 'api4.jscrambler.com');
    expect(config).toHaveProperty('basePath', '');
    expect(config).toHaveProperty('jscramblerVersion', 'stable');
    expect(config).toHaveProperty('werror', true);
    expect(config).toHaveProperty('clientId');
    expect(config).toHaveProperty('utc', true);
    expect(config).toHaveProperty('maxRetries', 5);
    expect(config).toHaveProperty('saveSrc', true);
  });
});
