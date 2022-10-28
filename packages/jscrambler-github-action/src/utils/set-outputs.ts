import * as core from '@actions/core';

interface OutputParams {
  protectionId: string;
}

export default function setOutputs(outputs: OutputParams) {
  core.setOutput("protection-id", outputs.protectionId);
}
