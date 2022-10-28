import * as core from '@actions/core';
import getInputs, {
  getBooleanParam,
  getStringArrayParam,
  getStringParam,
  getProxyParams,
  InputParams
} from '../get-inputs';

describe('getStringParam', function () {
  it('returns the given string value from the relevant input', function () {
    const stub = jest
      .spyOn(core, 'getInput')
      .mockReturnValue('hello');

    expect(getStringParam('hello-param')).toBe('hello');
    expect(stub).toHaveBeenCalledWith('hello-param');
  });

  it('returns undefined if the input is empty', function () {
    const stub = jest
      .spyOn(core, 'getInput')
      .mockReturnValue('');

    expect(getStringParam('hello-param')).toBe(undefined);
    expect(stub).toHaveBeenCalledWith('hello-param');
  });
});

describe('getBooleanParam', function () {
  it('returns the given boolean value from the relevant input', function () {
    const getBooleanInputStub = jest
      .spyOn(core, 'getBooleanInput')
      .mockReturnValue(true);
    const getInputStub = jest
      .spyOn(core, 'getInput')
      .mockReturnValue('true');

    expect(getBooleanParam('hello-param')).toBe(true);
    expect(getBooleanInputStub).toHaveBeenCalledWith('hello-param');
    expect(getInputStub).toHaveBeenCalledWith('hello-param');
  });

  it('returns undefined if the input is empty', function () {
    const getBooleanInputStub = jest
      .spyOn(core, 'getBooleanInput')
      .mockReturnValue(false);
    const getInputStub = jest
      .spyOn(core, 'getInput')
      .mockReturnValue('');

    expect(getBooleanParam('hello-param')).toBe(undefined);
    expect(getBooleanInputStub).not.toHaveBeenCalled();
    expect(getInputStub).toHaveBeenCalledWith('hello-param');
  });
});

describe('getStringArrayParam', function () {
  it('returns the given string array value from the relevant input', function () {
    const stub = jest
      .spyOn(core, 'getMultilineInput')
      .mockReturnValue(['a', 'b']);

    expect(getStringArrayParam('hello-param')).toStrictEqual(['a', 'b']);
    expect(stub).toHaveBeenCalledWith('hello-param');
  });

  it('ignores empty lines', function () {
    const stub = jest
      .spyOn(core, 'getMultilineInput')
      .mockReturnValue(['a', '', 'b', '']);

    expect(getStringArrayParam('hello-param')).toStrictEqual(['a', 'b']);
    expect(stub).toHaveBeenCalledWith('hello-param');
  });

  it('returns undefined if no value is specified', function () {
    const stub = jest
      .spyOn(core, 'getMultilineInput')
      .mockReturnValue(['']);

    expect(getStringArrayParam('hello-param')).toStrictEqual(undefined);
    expect(stub).toHaveBeenCalledWith('hello-param');
  });
});

describe('getProxyParams', function () {
  it('returns undefined if no proxy values are specified', function () {
    const stub = jest.spyOn(core, 'getInput').mockReturnValue('');

    expect(getProxyParams()).toBe(undefined);

    expect(stub).toHaveBeenCalledWith('proxy-host');
    expect(stub).toHaveBeenCalledWith('proxy-port');
    expect(stub).toHaveBeenCalledWith('proxy-auth-username');
    expect(stub).toHaveBeenCalledWith('proxy-auth-password');
  });

  it('returns the proxy params if specified', function () {
    const stub = jest.spyOn(core, 'getInput').mockImplementation(name => name);

    expect(getProxyParams()).toStrictEqual({
      host: 'proxy-host',
      port: 'proxy-port',
      auth: {
        username: 'proxy-auth-username',
        password: 'proxy-auth-password',
      }
    });

    expect(stub).toHaveBeenCalledWith('proxy-host');
    expect(stub).toHaveBeenCalledWith('proxy-port');
    expect(stub).toHaveBeenCalledWith('proxy-auth-username');
    expect(stub).toHaveBeenCalledWith('proxy-auth-password');
  });
});

describe('getInputParams', function () {
  it('returns the specified dummy values', function () {
    jest.spyOn(core, 'getInput').mockImplementation(name => name);
    jest.spyOn(core, 'getBooleanInput').mockReturnValue(true);
    jest.spyOn(core, 'getMultilineInput').mockImplementation(name => [name]);

    const expectedValue: InputParams = {
      keys: {
        secretKey: 'secret-key',
        accessKey: 'access-key',
      },
      jscramblerConfigPath: 'jscrambler-config-path',
      applicationId: 'application-id',
      filesSrc: ['files-src'],
      filesDest: 'files-dest',
      jscramblerVersion: 'jscrambler-version',
      protocol: 'protocol',
      host: 'host',
      port: 'port',
      basePath: 'base-path',
      sourceMapsOutputPath: 'source-maps-output-path',
      symbolTableOutputPath: 'symbol-table-output-path',
      debugMode: true,
      proxy: {
        host: 'proxy-host',
        port: 'proxy-port',
        auth: {
          username: 'proxy-auth-username',
          password: 'proxy-auth-password',
        },
      }
    };
    expect(getInputs()).toStrictEqual(expectedValue);
  })
});

afterEach(() => {
  jest.resetAllMocks();
});
