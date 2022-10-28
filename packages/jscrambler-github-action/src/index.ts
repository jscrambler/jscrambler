import * as core from '@actions/core';
import defaults from 'lodash.defaults';
import {readFile} from 'fs/promises';
import getInputs from './get-inputs';
import setOutputs from './set-outputs';

// Types are not currently available for the jscrambler package
const jscrambler = require('jscrambler').default;

async function launch() {
  // Simply read and log the application ID for testing purposes
  const params = getInputs();

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

  const protectionId = await jscrambler.protectAndDownload(params);

  setOutputs({
    protectionId,
  });
}

launch().catch(error => {
  core.setFailed(error.message);
});
