export default function cleanupInputFields(args, fragments, options) {
  let cleanedUpFragments = fragments;

  // tolerateMinification
  if (
    !args.some(f => f.name === 'data') ||
    !args
      .find(arg => arg.name === 'data')
      .type.inputFields.some(e => e.name === 'tolerateMinification')
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
