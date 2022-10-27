import * as core from '@actions/core';

try {
  // Simply read and log the application ID for testing purposes
  const applicationId = core.getMultilineInput('files-src');

  console.log({
    applicationId
  });

  core.setOutput("protection-id", 123);

} catch (error) {
  core.setFailed(error.message);
}
