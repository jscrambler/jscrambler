import { jest } from '@jest/globals';
import { CLIENT_IDS } from '../constants';

describe('config', () => {
  let config;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should load default configuration', async () => {
    jest.doMock('rc', () => {
      return jest.fn((name, defaults) => defaults);
    });

    const configModule = await import('../config');
    config = configModule.default;

    expect(config).toEqual({
      keys: {},
      host: 'api4.jscrambler.com',
      basePath: '',
      jscramblerVersion: 'stable',
      werror: true,
      clientId: CLIENT_IDS.CLI,
      utc: true,
      maxRetries: 5,
      saveSrc: true
    });
  });

  it('should merge RC configuration with defaults', async () => {
    const customConfig = {
      keys: {
        accessKey: 'test-access',
        secretKey: 'test-secret'
      },
      host: 'custom.jscrambler.com',
      werror: false
    };

    jest.doMock('rc', () => {
      return jest.fn((name, defaults) => ({
        ...defaults,
        ...customConfig
      }));
    });

    const configModule = await import('../config');
    config = configModule.default;

    expect(config.keys).toEqual(customConfig.keys);
    expect(config.host).toBe('custom.jscrambler.com');
    expect(config.werror).toBe(false);
    expect(config.clientId).toBe(CLIENT_IDS.CLI);
    expect(config.maxRetries).toBe(5);
  });

  it('should call rc with correct parameters', async () => {
    const rcMock = jest.fn((name, defaults) => defaults);
    
    jest.doMock('rc', () => rcMock);

    await import('../config');

    expect(rcMock).toHaveBeenCalledWith(
      'jscrambler',
      expect.objectContaining({
        keys: {},
        host: 'api4.jscrambler.com',
        basePath: '',
        jscramblerVersion: 'stable',
        werror: true,
        clientId: CLIENT_IDS.CLI,
        utc: true,
        maxRetries: 5,
        saveSrc: true
      }),
      []
    );
  });

  it('should use empty array for argv to avoid getting variables from argv', async () => {
    const rcMock = jest.fn((name, defaults, argv) => {
      expect(argv).toEqual([]);
      return defaults;
    });
    
    jest.doMock('rc', () => rcMock);

    await import('../config');

    expect(rcMock).toHaveBeenCalled();
  });
});