import * as core from '@actions/core';
import getInputs from './get-inputs';
import setOutputs from './set-outputs';

try {
  // Simply read and log the application ID for testing purposes
  const params = getInputs();

  console.log('test param', params.applicationId);

  setOutputs({
    protectionId: 'dummy-value',
  })
} catch (error) {
  core.setFailed(error.message);
}
