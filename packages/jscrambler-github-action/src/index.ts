import * as core from '@actions/core';
import getInputs from './get-inputs';
import setOutputs from './set-outputs';

// Types are not currently available for the jscrambler package
const jscrambler = require('jscrambler').default;

async function launch() {
  // Simply read and log the application ID for testing purposes
  const params = getInputs();

  const protectionId = await jscrambler.protectAndDownload(params);

  setOutputs({
    protectionId,
  });
}

launch().catch(error => {
  core.setFailed(error.message);
});
