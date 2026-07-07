const path = require('path');

/** commands used to build the bundle
 *  - bundle: react native standard bundle command for android/iOS
 *  - export:embed: react native export command for expo builds
 *  - build-kepler: react native legacy bundle command for VegaOS
 *  - build-vega: react native current bundle command for VegaOS
 */
const EXPO_BUNDLE_CMDS = ['export:embed'];
const VEGA_BUNDLE_CMDS = ['build-kepler', 'build-vega'];
const BUNDLE_CMDS = ['bundle', ...VEGA_BUNDLE_CMDS, ...EXPO_BUNDLE_CMDS ];
const BUNDLE_OUTPUT_CLI_ARG = '--bundle-output';
const BUNDLE_SOURCEMAP_OUTPUT_CLI_ARG = '--sourcemap-output';
const BUNDLE_DEV_CLI_ARG = '--dev';
const BUNDLE_EAGER_CLI_ARG = '--eager';
// path.join so it supports both linux and windows fs
const INIT_CORE_MODULE = path.join(process.platform === 'win32' ? '/' : '', 'node_modules', 'react-native', 'Libraries', 'Core', 'InitializeCore.js');
const JSCRAMBLER_CLIENT_ID = 6;
const JSCRAMBLER_IGNORE = '.jscramblerignore';
const JSCRAMBLER_TEMP_FOLDER = '.jscrambler';
const JSCRAMBLER_DIST_TEMP_FOLDER = `${JSCRAMBLER_TEMP_FOLDER}/dist`;
const JSCRAMBLER_SOURCE_MAPS_TEMP_FOLDER = `${JSCRAMBLER_DIST_TEMP_FOLDER}/jscramblerSourceMaps`;
const JSCRAMBLER_PROTECTION_ID_FILE = `${JSCRAMBLER_TEMP_FOLDER}/protectionId`;
const JSCRAMBLER_BEG_ANNOTATION = '"JSCRAMBLER-BEG";';
const JSCRAMBLER_END_ANNOTATION = '"JSCRAMBLER-END";';
const JSCRAMBLER_EXTS = /.(j|t)s(x)?$/i;
const JSCRAMBLER_SELF_DEFENDING = 'selfDefending';
const JSCRAMBLER_ANTI_TAMPERING = 'antiTampering';
const JSCRAMBLER_SELF_HEALING = "selfHealing";
const JSCRAMBLER_ANTI_TAMPERING_MODE_RCK = 'RCK';
const JSCRAMBLER_ANTI_TAMPERING_MODE_SKL = 'SKL';
const JSCRAMBLER_GLOBAL_VARIABLE_INDIRECTION = 'globalVariableIndirection';
const JSCRAMBLER_TOLERATE_BENIGN_POISONING = 'tolerateBenignPoisoning';
const HERMES_SHOW_SOURCE_DIRECTIVE = '"show source";';
const JSCRAMBLER_HERMES_INCOMPATIBILITIES = [
  {
    slugName: JSCRAMBLER_SELF_DEFENDING,
    errorMessage: `Jscrambler ${JSCRAMBLER_SELF_DEFENDING} transformation is not compatible with Hermes engine. Consider using ${JSCRAMBLER_ANTI_TAMPERING} transformation instead`,
  },
];
const JSCRAMBLER_HERMES_ADD_SHOW_SOURCE_DIRECTIVE = [
  JSCRAMBLER_ANTI_TAMPERING,
  JSCRAMBLER_SELF_HEALING
];

module.exports = {
  BUNDLE_CMDS,
  EXPO_BUNDLE_CMDS,
  VEGA_BUNDLE_CMDS,
  BUNDLE_OUTPUT_CLI_ARG,
  BUNDLE_SOURCEMAP_OUTPUT_CLI_ARG,
  BUNDLE_DEV_CLI_ARG,
  BUNDLE_EAGER_CLI_ARG,
  INIT_CORE_MODULE,
  JSCRAMBLER_CLIENT_ID,
  JSCRAMBLER_IGNORE,
  JSCRAMBLER_TEMP_FOLDER,
  JSCRAMBLER_DIST_TEMP_FOLDER,
  JSCRAMBLER_SOURCE_MAPS_TEMP_FOLDER,
  JSCRAMBLER_PROTECTION_ID_FILE,
  JSCRAMBLER_BEG_ANNOTATION,
  JSCRAMBLER_END_ANNOTATION,
  JSCRAMBLER_SELF_DEFENDING,
  JSCRAMBLER_GLOBAL_VARIABLE_INDIRECTION,
  JSCRAMBLER_TOLERATE_BENIGN_POISONING,
  JSCRAMBLER_ANTI_TAMPERING,
  JSCRAMBLER_ANTI_TAMPERING_MODE_RCK,
  JSCRAMBLER_SELF_HEALING,
  JSCRAMBLER_HERMES_INCOMPATIBILITIES,
  JSCRAMBLER_HERMES_ADD_SHOW_SOURCE_DIRECTIVE,
  JSCRAMBLER_ANTI_TAMPERING_MODE_SKL,
  HERMES_SHOW_SOURCE_DIRECTIVE,
  JSCRAMBLER_EXTS,
}
