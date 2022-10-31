import buildParamsFromInputs from '../build-params-from-inputs';
import * as fs from 'fs/promises';
import { InputParams } from '../get-inputs';

jest.mock('fs/promises');

/**
 * Make it so we don't have to specify every single mandatory field in InputParams
 * in the tests.
 */
function completeConfig(params: Partial<InputParams>): InputParams {
  return {
    keys: {},
    ...params,
  };
}

test('does not load any config file if jscramblerConfigPath is missing', async function () {
  const stub = jest.spyOn(fs, 'readFile').mockResolvedValue('{}');

  const config: Partial<InputParams> = {
    applicationId: 'a',
  };
  const {finalParams} = await buildParamsFromInputs(completeConfig(config));

  expect(stub).not.toBeCalled();
  expect(finalParams.applicationId).toBe('a');
});

test('combines values from the config file and the passed parameters', async function () {
  const stub = jest.spyOn(fs, 'readFile').mockResolvedValue('{"host": "test"}');

  const config: Partial<InputParams> = {
    applicationId: 'a',
    jscramblerConfigPath: 'test.json',
  };
  const {finalParams} = await buildParamsFromInputs(completeConfig(config));

  expect(stub).toBeCalledTimes(1);
  expect(stub).toBeCalledWith('test.json', 'utf-8');
  expect(finalParams.applicationId).toBe('a');
  expect(finalParams.host).toBe('test');
});

test('passed parameters override config parameters', async function () {
  const stub = jest.spyOn(fs, 'readFile').mockResolvedValue('{"applicationId": "b"}');

  const config: Partial<InputParams> = {
    applicationId: 'a',
    jscramblerConfigPath: 'test.json',
  };
  const {finalParams} = await buildParamsFromInputs(completeConfig(config));

  expect(stub).toBeCalledTimes(1);
  expect(stub).toBeCalledWith('test.json', 'utf-8');
  expect(finalParams.applicationId).toBe('a');
});

test('specifies source maps output', async function () {
  const config: Partial<InputParams> = {
    sourceMapsOutputPath: 'output.json',
  };
  const {finalParams, sourceMapsOutputPath} = await buildParamsFromInputs(completeConfig(config));
  expect(finalParams.sourceMapsOutputPath).toBe(undefined);
  expect(finalParams.sourceMaps).toStrictEqual({
    sourceContent: true,
  });
  expect(sourceMapsOutputPath).toBe('output.json');
});

test('specifies symbol table output', async function () {
  const config: Partial<InputParams> = {
    symbolTableOutputPath: 'output',
  };
  const {finalParams, symbolTableOutputPath} = await buildParamsFromInputs(completeConfig(config));
  expect(finalParams.symbolTableOutputPath).toBe(undefined);
  expect(symbolTableOutputPath).toBe('output');
});


afterEach(() => {
  jest.clearAllMocks();
});
