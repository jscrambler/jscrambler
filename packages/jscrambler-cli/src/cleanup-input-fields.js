export default function cleanupInputFields(args, fragments, options) {
  let cleanedUpFragments = fragments;

  // tolerateMinification
  const dataArg = args.find(arg => arg.name === 'data');
  const hasTolerateMinificationArg =
    dataArg && dataArg.type.inputFields.some(e => e.name === 'tolerateMinification');

  if (
    !hasTolerateMinificationArg &&
    typeof options.tolerateMinification !== 'undefined'
  ) {
    options.tolerateMinification = undefined;
    cleanedUpFragments = cleanedUpFragments.replace(
      /,?[\s|\n]*tolerateMinification/,
      ''
    );
    console.warn(
      'This API Version does not support the tolerateMinification argument.'
    );
  }

  return [options, cleanedUpFragments];
}
