export default function cleanupInputFields(args, fragments, options = {}) {
  let cleanedUpFragments = fragments;

  const dataArg = args.find(arg => arg.name === 'data');

  function fieldCleanUp(field) {
    const hasFieldArg =
      dataArg && dataArg.type.inputFields.some(e => e.name === field);

    if (!hasFieldArg && typeof options[field] !== 'undefined') {
      options[field] = undefined;
      cleanedUpFragments = cleanedUpFragments.replace(
        new RegExp(`,?[\s|\n]*${field}`),
        ''
      );

      console.warn(`This API Version does not support the ${field} argument.`);
    }
  }

  ['tolerateMinification', 'useProfilingData', 'useAppClassification', 'inputSymbolTable', 'entryPoint'].forEach(fieldCleanUp);

  return [options, cleanedUpFragments];
}
