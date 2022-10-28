import * as core from '@actions/core';

export interface InputParams {
  keys: {
    secretKey?: string | undefined;
    accessKey?: string | undefined;
  };
  jscramblerConfigPath?: string | undefined;
  applicationId?: string | undefined;
  filesSrc?: string[] | undefined;
  filesDest?: string | undefined;
  jscramblerVersion?: string | undefined;
  protocol?: string | undefined;
  host?: string | undefined;
  port?: string | undefined;
  basePath?: string | undefined;
  sourceMapsOutputPath?: string | undefined;
  debugMode?: boolean | undefined;
};

export function getStringParam(paramName: string): string | undefined {
  const value = core.getInput(paramName);

  return value !== '' ? value : undefined;
}

export function getStringArrayParam(paramName: string): string[] | undefined {
  const value = core.getMultilineInput(paramName).filter(line => line !== '');

  return value.length !== 0 ? value : undefined;
}

export function getBooleanParam(paramName: string): boolean | undefined {
  if (core.getInput(paramName) === '') {
    return undefined;
  }
  return core.getBooleanInput(paramName);
}

export default function getInputs(): InputParams {
  return {
    keys: {
      secretKey: getStringParam('secret-key'),
      accessKey: getStringParam('access-key'),
    },
    jscramblerConfigPath: getStringParam('jscrambler-config-path'),
    applicationId: getStringParam('application-id'),
    filesSrc: getStringArrayParam('files-src'),
    filesDest: getStringParam('files-dest'),
    jscramblerVersion: getStringParam('jscrambler-version'),
    protocol: getStringParam('protocol'),
    host: getStringParam('host'),
    port: getStringParam('port'),
    basePath: getStringParam('base-path'),
    sourceMapsOutputPath: getStringParam('source-maps-output-path'),
    debugMode: getBooleanParam('debug-mode'),
  };
}
