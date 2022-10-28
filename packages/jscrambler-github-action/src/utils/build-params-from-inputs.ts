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

  const {sourceMapOutputPath} = params;
  if (sourceMapOutputPath !== undefined) {
    finalParams.sourceMaps = true;
  }

  delete finalParams.jscramblerConfigPath;
  delete finalParams.sourceMapOutputPath;
  return {finalParams, sourceMapOutputPath};
}
