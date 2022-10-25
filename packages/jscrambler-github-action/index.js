const core = require('@actions/core');
const github = require('@actions/github');

try {
  // Simply read and log the application ID for testing purposes
  const applicationId = core.getInput('application-id');

  console.log({
    applicationId
  });

  const success = false;
  core.setOutput("protection_id", 123);
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`);
} catch (error) {
  core.setFailed(error.message);
}
