#!/usr/bin/env node

import commander from 'commander';
import defaults from 'lodash.defaults';
import glob from 'glob';
import path from 'path';
import filesizeParser from 'filesize-parser';

import _config from '../config';
import jscrambler from '../';
import {mergeAndParseParams} from '../cli';

const debug = !!process.env.DEBUG;
const validateBool = option => val => {
  if (!/^(true|false)$/i.test(val)) {
    console.error(`*${option}* requires a <bool> value.`);
    process.exit(1);
  }
  return val.toLowerCase();
};

const validateCodeHardeningThreshold = val => {
  let inBytes;
  try {
    inBytes = filesizeParser(val);
  } catch (e) {
    console.error(
      '*code-hardening-threshold* requires a valid <threshold> value. Format: {number}{unit="b,kb,mb"}. Example: --code-hardening-threshold 200kb'
    );
    process.exit(1);
  }
  return inBytes;
};

const validateProfilingDataMode = mode => {
  const availableModes = ['automatic', 'annotations', 'off'];

  const normalizedMode = mode.toLowerCase();

  if (!availableModes.includes(normalizedMode)) {
    console.error(
      `*profiling-data-mode* requires one of the following modes: {${availableModes.toString()}}. Example: --profiling-data-mode ${availableModes[0]}`
    );
    process.exit(1);
  }

  return normalizedMode;
};

const availableEnvironments = ['node', 'browser', 'isomorphic', 'automatic'];
const validateForceAppEnvironment = env => {
  const normalizeEnvironment = env.toLowerCase();

  if (!availableEnvironments.includes(normalizeEnvironment)) {
    console.error(
      `*force-app-environment* requires one of the following values: {${availableEnvironments.toString()}}. Example: --force-app-environment ${availableEnvironments[0]}`
    );
    process.exit(1);
  }

  return normalizeEnvironment;
};

commander
  .version(require('../../package.json').version)
  .usage('[options] <file ...>')
  .option('-a, --access-key <accessKey>', 'Access key')
  .option('-c, --config <config>', 'Jscrambler configuration options')
  .option('-H, --host <host>', 'Hostname')
  .option('-i, --application-id <id>', 'Application ID')
  .option('-o, --output-dir <dir>', 'Output directory')
  .option('-p, --port <port>', 'Port')
  .option('--base-path <path>', 'Base Path')
  .option('--protocol <protocol>', 'Protocol (http or https)')
  .option('--cafile <path>', 'Internal certificate authority')
  .option('-C, --cwd <dir>', 'Current Working Directory')
  .option('-s, --secret-key <secretKey>', 'Secret key')
  .option('-m, --source-maps <id>', 'Download source maps')
  .option('-R, --randomization-seed <seed>', 'Set randomization seed')
  .option('--instrument', 'Instrument file(s) before start profiling. ATTENTION: previous profiling information will be deleted')
  .option('--start-profiling', 'Starts profiling (assumes an already instrumented application)')
  .option('--stop-profiling', 'Stops profiling')
  .option(
    '--code-hardening-threshold <threshold>',
    'Set code hardening file size threshold. Format: {value}{unit="b,kb,mb"}. Example: 200kb',
    validateCodeHardeningThreshold
  )
  .option(
    '--recommended-order <bool>',
    'Use recommended order',
    validateBool('recommended-order')
  )
  .option(
    '-W, --werror <bool>',
    'Set werror flag value (default: true)',
    validateBool('werror')
  )
  .option(
    '--utc <bool>',
    'Set UTC as the request time zone. Otherwise it uses the local time zone (default: true)',
    validateBool('utc')
  )
  .option(
    '--tolerate-minification <bool>',
    `Don't detect minification as malicious tampering (default: true)`,
    validateBool('tolerate-minification')
  )
  .option(
    '--use-profiling-data <bool>',
    `(version 6.2 only) Protection should use the existing profiling data (default: true)`,
    validateBool('use-profiling-data')
  )
  .option(
    '--profiling-data-mode <mode>',
    `(version 6.3 and above) Select profiling mode (default: automatic)`,
    validateProfilingDataMode
  )
  .option(
    '--remove-profiling-data',
    `Removes the current application profiling information`
  )
  .option(
    '--use-app-classification <bool>',
    '(version 6.3 and above) Protection should use Application Classification metadata when protecting (default: true)',
    validateBool('--use-app-classification')
  )
  .option(
    '--input-symbol-table <file>',
    '(version 6.3 and above) Protection should use symbol table when protecting. (default: no file)'
  )
  .option('--output-symbol-table <id>', '(version 6.3 and above) Download output symbol table (json)')
  .option('--jscramblerVersion <version>', 'Use a specific Jscrambler version')
  .option('--debugMode', 'Protect in debug mode')
  .option('--skip-sources', 'Prevent source files from being updated')
  .option(
    '--force-app-environment <environment>',
    `(version 7.1 and above) Override application\'s environment detected automatically. Possible values: ${availableEnvironments.toString()}`,
    validateForceAppEnvironment
  )
  .parse(process.argv);

let globSrc, filesSrc, config;

// If -c, --config file was provided
if (commander.config) {
  // We're using `commander` (CLI) as the source of all truths, falling back to
  // the `config` provided by the file passed as argument
  config = require(path.resolve(commander.config, '.'));
} else {
  config = {};
}

config.accessKey =
  commander.accessKey || (config.keys ? config.keys.accessKey : undefined);
config.secretKey =
  commander.secretKey || (config.keys ? config.keys.secretKey : undefined);
config.host = commander.host || config.host;
config.port = commander.port || config.port;
config.basePath = commander.basePath || config.basePath;
config.port = config.port && parseInt(config.port);
config.protocol = commander.protocol || config.protocol;
config.cafile = commander.cafile || config.cafile;
config.filesDest = commander.outputDir || config.filesDest;
config.applicationId = commander.applicationId || config.applicationId;
config.randomizationSeed =
  commander.randomizationSeed || config.randomizationSeed;
config.cwd = commander.cwd || config.cwd;
config.useRecommendedOrder = commander.recommendedOrder
  ? commander.recommendedOrder !== 'false'
  : config.useRecommendedOrder;
config.tolerateMinification = commander.tolerateMinification
  ? commander.tolerateMinification !== 'false'
  : config.tolerateMinification;
config.werror = commander.werror ? commander.werror !== 'false' : config.werror;
config.jscramblerVersion =
  commander.jscramblerVersion || config.jscramblerVersion;
config.inputSymbolTable = commander.inputSymbolTable || config.inputSymbolTable;
config.removeProfilingData = commander.removeProfilingData;
config.skipSources = commander.skipSources;
config.debugMode = commander.debugMode || config.debugMode;

// handle codeHardening = 0
if (typeof commander.codeHardeningThreshold === 'undefined') {
  config.codeHardeningThreshold = config.codeHardeningThreshold
  ? validateCodeHardeningThreshold(config.codeHardeningThreshold)
  : undefined;
} else {
  config.codeHardeningThreshold = commander.codeHardeningThreshold;
}

if (commander.profilingDataMode) {
  config.profilingDataMode = commander.profilingDataMode;
} else {
  config.profilingDataMode = config.profilingDataMode ?
  validateProfilingDataMode(config.profilingDataMode) :
  undefined;
}

if (commander.utc) {
  config.utc = commander.utc !== 'false';
}

if (commander.useProfilingData) {
  config.useProfilingData = commander.useProfilingData !== 'false';
}

if (commander.useAppClassification) {
  config.useAppClassification = commander.useAppClassification !== 'false';
}

if (config.jscramblerVersion && !/^(?:\d+\.\d+(?:-f)?|stable|latest)$/.test(config.jscramblerVersion)) {
  console.error(
    'The Jscrambler version must be in the form of $major.$minor or the words stable and latest. (e.g. 5.2, stable, latest)'
  );
  process.exit(1);
}

if (commander.forceAppEnvironment) {
  config.forceAppEnvironment = commander.forceAppEnvironment;
} else {
  config.forceAppEnvironment =
    config.forceAppEnvironment ?
    validateForceAppEnvironment(config.forceAppEnvironment) :
    undefined;
}

config = defaults(config, _config);

if (config.codeHardeningThreshold){
  config.codeHardeningThreshold = validateCodeHardeningThreshold(config.codeHardeningThreshold);
}

if (config.profilingDataMode) {
  config.profilingDataMode = validateProfilingDataMode(config.profilingDataMode);
}

globSrc = config.filesSrc;
// If src paths have been provided
if (commander.args.length > 0) {
  globSrc = commander.args;
}

if (globSrc && globSrc.length) {
  filesSrc = [];
  // Iterate `globSrc` to build a list of source files into `filesSrc`
  for (let i = 0, l = globSrc.length; i < l; i += 1) {
    // Calling sync `glob` because async is pointless for the CLI use case
    // (as of now at least)

    // If the user is providing a zip alongside more files
    if (path.extname(globSrc[i]) === '.zip' && globSrc.length > 1) {
      console.error(
        'Please provide either a zip file containing all your source files or use the minimatch syntax'
      );
      process.exit(1);
    }

    const tmpGlob = glob.sync(globSrc[i], {
      dot: true
    });

    if (config.werror && tmpGlob.length === 0) {
      console.error(`Pattern "${globSrc[i]}" doesn't match any files.`);
      process.exit(1);
    }

    if (debug) {
      if (tmpGlob.length === 0) {
        console.log(
          `Pattern "${globSrc[i]}" doesn't match any files. Will be ignored.`
        );
      } else {
        console.log(`Pattern "${globSrc[i]}" matched the following files:`);
        tmpGlob.forEach(file => {
          console.log(`    ${file}`);
        });
      }
    }
    filesSrc = filesSrc.concat(tmpGlob);
  }
  if (filesSrc.length === 0) {
    console.error('No files matched.');
    process.exit(1);
  }
} else if (debug) {
  console.log(
    'No filesSrc provided. Using the ones in the application (if any).'
  );
}

const {
  applicationId,
  accessKey,
  secretKey,
  filesDest,
  host,
  port,
  basePath,
  protocol,
  cafile,
  applicationTypes,
  languageSpecifications,
  areSubscribersOrdered,
  cwd,
  randomizationSeed,
  sourceMaps = false,
  useRecommendedOrder,
  werror,
  tolerateMinification,
  jscramblerVersion,
  debugMode,
  proxy,
  codeHardeningThreshold,
  useProfilingData,
  profilingDataMode,
  browsers,
  useAppClassification,
  removeProfilingData,
  skipSources,
  inputSymbolTable,
  utc,
  entryPoint,
  excludeList,
  forceAppEnvironment
} = config;

const params = mergeAndParseParams(commander, config.params);

const incompatibleOptions = ['sourceMaps', 'instrument', 'startProfiling', 'stopProfiling'];
const usedIncompatibleOptions = [];
for (const incompatibleOption of incompatibleOptions) {
  if (commander[incompatibleOption]) {
    usedIncompatibleOptions.push(incompatibleOption);
  }
}
if (usedIncompatibleOptions.length > 1) {
  console.error('Using mutually exclusive options:', usedIncompatibleOptions);
  process.exit(1);
}

const clientSettings = {
  keys: {
    accessKey,
    secretKey
  },
  host,
  port,
  basePath,
  protocol,
  cafile,
  proxy,
  utc,
  jscramblerVersion
};

if (commander.sourceMaps) {
  // Go, go, go download
  (async () => {
    try {
      await jscrambler.downloadSourceMaps({
        ...clientSettings,
        filesDest,
        filesSrc,
        protectionId: commander.sourceMaps
      });
    } catch (error) {
      console.error(debug ? error : error.message || error);
      process.exit(1);
    }
  })();
} else if (commander.outputSymbolTable) {
  // Go, go, go download
  (async () => {
    try {
      await jscrambler.downloadSymbolTable({
        ...clientSettings,
        filesDest,
        filesSrc,
        protectionId: commander.outputSymbolTable
      });
    } catch (error) {
      console.error(debug ? error : error.message || error);
      process.exit(1);
    }
  })();
} else if (commander.instrument) {
  jscrambler
    .instrumentAndDownload({
      ...clientSettings,
      applicationId,
      filesSrc,
      filesDest,
      skipSources,
      cwd
    })
    .catch(error => {
      console.error(debug ? error : error.message || error);
      process.exit(1);
    });
} else if (commander.startProfiling) {
  jscrambler
    .setProfilingState(
      {
        ...clientSettings,
        applicationId
      },
      'RUNNING',
      'STARTED',
      "Exercise your application and when you're finished run *--stop-profiling* command"
    )
    .catch(error => {
      console.error(debug ? error : error.message || error);
      process.exit(1);
    });
} else if (commander.stopProfiling) {
  jscrambler
    .setProfilingState(
      {
        ...clientSettings,
        applicationId
      },
      'READY',
      'STOPPED',
      'Protect your application with 2 extra arguments: *--profiling-data-mode automatic* and *--skip-sources*'
    )
    .catch(error => {
      console.error(debug ? error : error.message || error);
      process.exit(1);
    });
} else {
  // Go, go, go
  (async () => {
    const protectAndDownloadOptions = {
      ...clientSettings,
      applicationId,
      filesSrc,
      filesDest,
      params,
      applicationTypes,
      languageSpecifications,
      areSubscribersOrdered,
      cwd,
      sourceMaps,
      randomizationSeed,
      useRecommendedOrder,
      tolerateMinification,
      debugMode,
      codeHardeningThreshold,
      useProfilingData,
      profilingDataMode,
      browsers,
      useAppClassification,
      skipSources,
      removeProfilingData,
      inputSymbolTable,
      entryPoint,
      excludeList,
      forceAppEnvironment
    };
    try {
      if (typeof werror !== 'undefined') {
        protectAndDownloadOptions.bail = werror;
      }
      await jscrambler.protectAndDownload(protectAndDownloadOptions);
    } catch (error) {
      console.error(debug ? error : error.message || error);
      process.exit(1);
    }
  })();
}
