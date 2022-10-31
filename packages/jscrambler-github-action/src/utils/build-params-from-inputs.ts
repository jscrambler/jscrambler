import {readFile} from 'fs/promises';
import defaults from 'lodash.defaults';
import type {InputParams} from './get-inputs';

export default async function buildParamsFromInputs(params: InputParams) {
  let finalParams: any;
  if (params.jscramblerConfigPath !== undefined) {
    // Explicit parameters take precedence over config-specified parameters
    // Note: require(...) wouldn't work here -- ncc doesn't allow dynamically loading modules
    const configFile = await readFile(params.jscramblerConfigPath, 'utf-8');
    const configObject = JSON.parse(configFile);
    finalParams = defaults(params, configObject);
  } else {
    finalParams = params;
  }

  const {sourceMapsOutputPath, symbolTableOutputPath} = params;

  if (sourceMapsOutputPath !== undefined) {
    finalParams.sourceMaps = {
      sourceContent: true
    };
  } else {
    finalParams.sourceMaps = false;
  }

  delete finalParams.jscramblerConfigPath;
  delete finalParams.sourceMapsOutputPath;
  delete finalParams.symbolTableOutputPath;
  return {finalParams, sourceMapsOutputPath, symbolTableOutputPath};
}
