import * as core from '@actions/core';
import setOutputs from '../set-outputs';

test('setOutputs', function () {
  const outputStub = jest.spyOn(core, 'setOutput').mockImplementation(() => {});

  setOutputs({
    protectionId: 'fake-protection-id',
  });

  expect(outputStub).toHaveBeenCalledWith('protection-id', 'fake-protection-id');
});

afterEach(() => {
  jest.resetAllMocks();
});
