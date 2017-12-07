import clone from 'lodash.clone';
import snakeCase from 'snake-case';

// Override params file changes with any specified command line options
// TODO Populate this list based on an external JSON
const isBoolFlag = {
  booleanToAnything: true,
  charToTernaryOperator: false,
  commaOperatorUnfolding: true,
  controlFlowFlattening: false,
  deadCodeInjection: true,
  dotToBracketNotation: true,
  duplicateLiteralsRemoval: false,
  extendPredicates: true,
  functionOutlining: true,
  functionReorder: true,
  identifiersRenaming: false,
  numberToString: true,
  propertyKeysObfuscation: true,
  propertyKeysReordering: true,
  regexObfuscation: true,
  stringConcealing: true,
  stringEncoding: true,
  stringSplitting: false,
  variableGrouping: true,
  assertionsRemoval: false,
  constantFolding: true,
  deadCodeElimination: true,
  debugCodeElimination: false,
  whitespaceRemoval: true,
  selfDefending: false,
  browserLock: false,
  dateLock: false,
  domainLock: false,
  osLock: false,
  preserveAnnotations: true
};

// Convert from command line option format to JScrambler API format.
export function mergeAndParseParams(commander, params) {
  const finalParams = clone(params || {});

  Object.keys(isBoolFlag).forEach(name => {
    if (commander[name] !== undefined) {
      const snakeCaseName = snakeCase(name);
      if (isBoolFlag[name] === true) {
        finalParams[snakeCaseName] = {
          status: 1
        };
      } else {
        finalParams[snakeCaseName] = commander[name];
      }
      if (typeof finalParams[snakeCaseName].status === 'undefined') {
        finalParams[snakeCaseName].status = 1;
      }
    }
  });

  return finalParams;
}
