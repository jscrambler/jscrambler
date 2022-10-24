const core = require('@actions/core');
const github = require('@actions/github');

try {
  const secretKey = core.getInput('secret-key');
  const accessKey = core.getInput('access-key');
  const applicationId = core.getInput('application-id');

  console.log({
    accessKey,
    secretKey,
    applicationId
  });

  const success = false;
  core.setOutput("success", success);
  core.setOutput("files", null);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
