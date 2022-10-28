import * as core from '@actions/core';
import buildParamsFromInputs from './utils/build-params-from-inputs';
import getInputs from './utils/get-inputs';
import setOutputs from './utils/set-outputs';

// Types are not currently available for the jscrambler package
const jscrambler = require('jscrambler').default;

async function launch() {
  const params = getInputs();
  const {finalParams, sourceMapOutputPath} = await buildParamsFromInputs(params);

  const protectionId = await jscrambler.protectAndDownload(finalParams);

  const downloadArtifactsParams = {
    ...finalParams,
    protectionId,
  };
  if (sourceMapOutputPath !== undefined) {
    await jscrambler.downloadSourceMaps(downloadArtifactsParams, sourceMapOutputPath);
  }

  setOutputs({
    protectionId,
  });
}

launch().catch(error => {
  core.setFailed(error.message);
});
