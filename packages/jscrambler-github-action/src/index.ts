import * as core from '@actions/core';
import buildParamsFromInputs from './utils/build-params-from-inputs';
import getInputs from './utils/get-inputs';
import setOutputs from './utils/set-outputs';

// Types are not currently available for the jscrambler package
const jscrambler = require('jscrambler').default;

async function launch() {
  const params = getInputs();
  const {
    finalParams,
    sourceMapsOutputPath,
    symbolTableOutputPath,
  } = await buildParamsFromInputs(params);

  const protectionId = await jscrambler.protectAndDownload(finalParams);

  const downloadArtifactsParams = {
    ...finalParams,
    // If filesSrc is specified, then Jscrambler prints a warning because
    // inputs make no sense in subsequent steps
    filesSrc: undefined,
    protectionId,
  };
  if (sourceMapsOutputPath !== undefined) {
    await jscrambler.downloadSourceMaps({
      ...downloadArtifactsParams,
      filesDest: sourceMapsOutputPath,
    });
  }
  if (symbolTableOutputPath !== undefined) {
    await jscrambler.downloadSymbolTable({
      ...downloadArtifactsParams,
      filesDest: symbolTableOutputPath,
    });
  }

  setOutputs({
    protectionId,
  });
}

launch().catch(error => {
  core.setFailed(error.message);
});
