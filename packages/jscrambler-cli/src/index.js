/* eslint-disable no-console */
import path from 'path';
import request from 'axios';
import defaults from 'lodash.defaults';
import fs from 'fs';

import config from './config';
import generateSignedParams from './generate-signed-params';
import JscramblerClient from './client';
import * as mutations from './mutations';
import * as queries from './queries';
import {HTTP_STATUS_CODES} from './constants';
import {zip, zipSources, unzip} from './zip';
import * as introspection from './introspection';
import { getMatchedFiles, validateThresholdFn } from './utils';

import getProtectionDefaultFragments, {
  getIntrospection,
} from './get-protection-default-fragments';

const {intoObjectType} = introspection;

const debug = !!process.env.DEBUG;
const APP_URL = 'https://app.jscrambler.com';
const POLLING_MIN_INTERVAL = 1000;
const POLLING_MAX_INTERVAL = 10000;
const INCREASE_POLL_INTERVAL_EVERY = 30000;
const MAX_PRINTED_ERRORS = 3;

/**
 * Calculate polling interval for protection and instrumentation.
 * Upper limit of {POLLING_MAX_INTERVAL}.
 * @param start
 * @returns {number|number}
 */
function getPollingInterval(start) {
  const pollingInterval = POLLING_MIN_INTERVAL * Math.ceil((Date.now() - start) / INCREASE_POLL_INTERVAL_EVERY);
  return pollingInterval >= POLLING_MAX_INTERVAL ? POLLING_MAX_INTERVAL : pollingInterval;
}

function errorHandler(res) {
  if (res.errors && res.errors.length) {
    res.errors.forEach(error => {
      throw new Error(`Error: ${error.message}`);
    });
  }

  if (res.data && res.data.errors) {
    res.data.errors.forEach(e => console.error(e.message));
    throw new Error('GraphQL Query Error');
  }

  if (res.message) {
    throw new Error(`Error: ${res.message}`);
  }

  return res;
}

function printSourcesErrors(errors) {
  console.error('Source errors:');
  for (let i = 0; i < Math.min(MAX_PRINTED_ERRORS, errors.length); i++) {
    let sourceErrorsMessage = errors[i].line
      ? ':' + errors[i].line + ':' + errors[i].column + ': '
      : ': ';
    console.error('- ' + errors[i].filename + sourceErrorsMessage + errors[i].message);
  }

  const errorsLeft = errors.length - MAX_PRINTED_ERRORS;

  if (errorsLeft > 0) {
    if (errorsLeft === 1) {
      console.error('There is 1 more error.');
    } else {
      console.error('There are ' + errorsLeft + ' more errors.');
    }
  }
  console.error();
}

function normalizeFileSizeFilter(parameters, fileSizeOption) {
  const validateFileSizeThreshold = validateThresholdFn(fileSizeOption);

  parameters
    .filter((parameter) => typeof parameter[fileSizeOption] === 'string')
    .forEach((parameter) => {
      // change from "1kb" to 1024 bytes

      // eslint-disable-next-line no-param-reassign
      parameter[fileSizeOption] = validateFileSizeThreshold(
        parameter[fileSizeOption],
      );
    });
}


function normalizeParameters(parameters) {
  let result;

  if (!Array.isArray(parameters)) {
    result = [];
    Object.keys(parameters).forEach(name => {
      result.push({
        name,
        options: parameters[name]
      });
    });
  } else {
    result = parameters;
  }

  normalizeFileSizeFilter(result, 'minFileSize');

  normalizeFileSizeFilter(result, 'maxFileSize');

  return result;
}

function buildFinalConfig(configPathOrObject) {
  const _config =
    typeof configPathOrObject === 'string'
      ? require(configPathOrObject)
      : configPathOrObject;

  return defaults(_config, config);
}

export default {
  Client: JscramblerClient,
  config,
  queries,
  generateSignedParams,
  /**
   * Remove and Add application sources
   * @param {object} client
   * @param {string} applicationId
   * @param {{
   *  sources: Array.<{filename: string, content: string}>,
   *  filesSrc: Array.<string>,
   *  cwd: string,
   *  saveSrc: boolean,
   *  appProfiling: ?object,
   *  runBeforeProtection?: Array<{type: string, target: string, source: string }>
   * }} opts
   * @returns {Promise<{extension: string, filename: string, content: *}>}
   */
  async updateApplicationSources(
    client,
    applicationId,
    {
      sources,
      filesSrc,
      cwd,
      appProfiling,
      saveSrc = true,
      runBeforeProtection = [],
    },
  ) {
    if (sources || (filesSrc && filesSrc.length)) {
      // prevent removing sources if profiling state is READY
      if (appProfiling && appProfiling.data && appProfiling.data.state === 'READY') {
        throw new Error(
          'You have a finished Profiling for this application so you are NOT ALLOWED to update sources. To override this behavior use *--remove-profiling-data* or *--skip-sources*.'
        );
      }

      const removeSourceRes = await this.removeSourceFromApplication(
        client,
        '',
        applicationId,
      );

      errorHandler(removeSourceRes);
    }

    let zipped;
    let source;

    if (filesSrc && filesSrc.length) {
      let _filesSrc = [];
      for (let i = 0, l = filesSrc.length; i < l; i += 1) {
        if (typeof filesSrc[i] === 'string') {
          _filesSrc = _filesSrc.concat(getMatchedFiles(filesSrc[i]));
        } else {
          _filesSrc.push(filesSrc[i]);
        }
      }

      if (debug) {
        console.log('Creating zip from source files');
      }

      if(runBeforeProtection.length > 0) {
        runBeforeProtection.map((element) => {
          if(!_filesSrc.includes(element.target)) {
            console.error('Error on beforeProtection: Target files need to be in the files to protect list (or filesSrc).');
            process.exit(1);
          }
        });
      }

      zipped = await zip(_filesSrc, cwd, runBeforeProtection);
    } else if (sources) {
      if (debug) {
        console.log('Creating zip from sources');
      }

      zipped = await zipSources(sources);
    }

    if (zipped) {
      const content = await zipped
        .generateAsync({
          type: 'base64',
          compression: 'DEFLATE',
          compressionOptions: {
            // 1 - 9 (max compression)
            level: 5
          }
        });

      if (debug) {
        console.log('Adding sources to application');
      }

      source = {
        content,
        filename: 'application.zip',
        extension: 'zip'
      };

      if (saveSrc) {
        errorHandler(
          await this.addApplicationSource(client, applicationId, source)
        );
      }
    }

    return source;
  },
  // This method is a shortcut method that accepts an object with everything needed
  // for the entire process of requesting an application protection and downloading
  // that same protection when the same ends.
  //
  // `configPathOrObject` can be a path to a JSON or directly an object containing
  // the following structure:
  //
  // ```json
  // {
  //   "keys": {
  //     "accessKey": "",
  //     "secretKey": ""
  //   },
  //   "applicationId": "",
  //   "filesDest": ""
  // }
  // ```
  //
  // Also the following optional parameters are accepted:
  //
  // ```json
  // {
  //   "filesSrc": [""],
  //   "params": {},
  //   "cwd": "",
  //   "host": "api.jscrambler.com",
  //   "port": "443",
  //   "basePath": ""
  // }
  // ```
  //
  // `filesSrc` supports glob patterns, and if it's provided it will replace the
  // entire application sources.
  //
  // `params` if provided will replace all the application transformation parameters.
  //
  // `cwd` allows you to set the current working directory to resolve problems with
  // relative paths with your `filesSrc` is outside the current working directory.
  //
  // Finally, `host` and `port` can be overridden if you to engage with a different
  // endpoint than the default one, useful if you're running an enterprise version of
  // Jscrambler or if you're provided access to beta features of our product.
  //
  async protectAndDownload(configPathOrObject, destCallback) {
    const start = Date.now();

    const finalConfig = buildFinalConfig(configPathOrObject);

    const {
      applicationId,
      host,
      port,
      basePath,
      protocol,
      cafile,
      keys,
      sources,
      stream = true,
      cwd,
      params,
      applicationTypes,
      languageSpecifications,
      sourceMaps,
      randomizationSeed,
      areSubscribersOrdered,
      useRecommendedOrder,
      bail = true,
      jscramblerVersion,
      debugMode,
      proxy,
      utc,
      clientId,
      tolerateMinification,
      codeHardeningThreshold,
      useProfilingData,
      browsers,
      useAppClassification,
      profilingDataMode,
      removeProfilingData,
      skipSources,
      inputSymbolTable,
      entryPoint,
      excludeList,
      numberOfProtections,
      ensureCodeAnnotation,
      forceAppEnvironment,
      deleteProtectionOnSuccess,
      mode,
      saveSrc,
      globalNamesPrefix,
      useGlobalNamesOnModules,
    } = finalConfig;

    const {accessKey, secretKey} = keys;

    const client = new this.Client({
      accessKey,
      secretKey,
      host,
      port,
      basePath,
      protocol,
      cafile,
      jscramblerVersion,
      proxy,
      utc,
      clientId
    });

    let filesSrc = finalConfig.filesSrc;
    let filesDest = finalConfig.filesDest;

    let runBeforeProtection = finalConfig.beforeProtection;

    if (finalConfig.numberOfProtections && finalConfig.numberOfProtections > 1) {
      console.log(`Protections will be stored in ${filesDest}${filesDest.slice(-1) === '/' ? '' : '/'}[protection-id]`)
    }

    if (sources) {
      filesSrc = undefined;
    }

    if (destCallback) {
      filesDest = undefined;
    }

    if (!applicationId) {
      throw new Error('Required *applicationId* not provided');
    }

    if (!filesDest && !destCallback) {
      throw new Error('Required *filesDest* not provided');
    }

    let source;
    if (!skipSources) {

      const appProfiling = await this.getApplicationProfiling(
        client,
        applicationId
      ).catch(e => {
        if (typeof profilingDataMode === 'string' && profilingDataMode !== 'off') {
          switch (e.statusCode) {
            case HTTP_STATUS_CODES.FORBIDDEN:
              throw new Error(`No ${profilingDataMode} profiling feature in your plan. Please set profilingDataMode to "off" or contact the Jscrambler Support.`);
            case HTTP_STATUS_CODES.NOT_FOUND:
              if (profilingDataMode === 'automatic') {
                throw new Error('You can not use the automatic mode without previous profiling having been done.');
              }
              break;
            case HTTP_STATUS_CODES.SERVICE_UNAVAILABLE:
              if (profilingDataMode === 'automatic') {
                throw e
              }
          }
        }
      });

      if (appProfiling && removeProfilingData) {
        await this.deleteProfiling(client, appProfiling.data.id);
        appProfiling.data.state = 'DELETED';
      }

      source = await this.updateApplicationSources(client, applicationId, {
        sources,
        filesSrc,
        cwd,
        appProfiling,
        runBeforeProtection,
        saveSrc,
      });
    } else {
      console.log('Update source files SKIPPED');
    }

    const updateData = {
      debugMode: !!debugMode,
      tolerateMinification,
      codeHardeningThreshold
    };

    if (params && Object.keys(params).length) {
      updateData.parameters = normalizeParameters(params);
      updateData.areSubscribersOrdered = Array.isArray(params);
    }

    const dataToValidate = {
      applicationTypes,
      areSubscribersOrdered,
      browsers,
      languageSpecifications,
      profilingDataMode,
      sourceMaps,
      useAppClassification,
      ensureCodeAnnotation,
      useProfilingData,
      useRecommendedOrder,
      mode,
    };

    for (const prop in dataToValidate) {
      const value = dataToValidate[prop];
      if (typeof value !== 'undefined') {
        updateData[prop] = value;
      }
    }

    if (
      (updateData.parameters ||
        updateData.applicationTypes ||
        updateData.languageSpecifications ||
        updateData.browsers ||
        typeof updateData.areSubscribersOrdered !== 'undefined') &&
      saveSrc
    ) {
      if (debug) {
        console.log('Updating parameters of protection');
      }

      const applicationUpdate = await intoObjectType(
        client,
        updateData,
        'ApplicationUpdate'
      );
      const updateApplicationRes = await this.updateApplication(
        client,
        applicationUpdate,
        undefined,
        applicationId,
      );
      if (debug) {
        console.log('Finished updating parameters of protection');
        console.error(updateApplicationRes);
      }
      errorHandler(updateApplicationRes);
    }

    if (debug) {
      console.log('Creating Application Protection');
    }

    const protectionOptions = {
      ...updateData,
      bail,
      entryPoint,
      excludeList,
      inputSymbolTable,
      randomizationSeed,
      source,
      tolerateMinification,
      numberOfProtections,
      forceAppEnvironment,
      mode,
      globalNamesPrefix,
      useGlobalNamesOnModules,
    };

    if (finalConfig.inputSymbolTable) {
      const inputSymbolTableContents = await fs.promises.readFile(
        finalConfig.inputSymbolTable,
        'utf-8',
      );
      protectionOptions.inputSymbolTable = inputSymbolTableContents;
    }

    const createApplicationProtectionRes = await this.createApplicationProtections(
      client,
      applicationId,
      protectionOptions
    );
    errorHandler(createApplicationProtectionRes);

    const protectionIds = createApplicationProtectionRes.data.protections.map(({_id}) => _id);

    const onExitCancelProtection = async () => {
      for(let i = 0; i < protectionIds.length; i++) {
        const protectionId = protectionIds[i];
        try {
          await this.cancelProtection(client, protectionId, applicationId);
          console.log('** Protection %s WAS CANCELLED **', protectionId)
        } catch (e) {
          if(debug) {
            console.error(e);
          }
        }
      }
      process.exit(1);
    };

    process.once('SIGINT', onExitCancelProtection)
      .once('SIGTERM', onExitCancelProtection);

    const downloadOptions = {
      filesDest,
      destCallback,
      stream,
      multiple: protectionOptions.numberOfProtections,
      deleteProtectionOnSuccess,
    }

    const processedProtections = await this.pollProtections(
      client,
      applicationId,
      protectionIds,
      await getProtectionDefaultFragments(client),
      downloadOptions,
    );

    process.removeListener('SIGINT', onExitCancelProtection).removeListener('SIGTERM', onExitCancelProtection);

    const handleProtection = async (protection) => {
      if (protection.growthWarning) {
        console.warn(`Warning: Your protected application has surpassed a reasonable file growth.\nFor more information on what might have caused this, please see the Protection Report.\nLink: ${APP_URL}.`);
      }
      if (protection.hasForcedDateLock) {
        console.warn(`Warning: Since your plan is a Trial, your protected files will stop working on ${protection.parameters.find(p => p.name === 'dateLock' && p.options.endDate).options.endDate}`)
      }
      if (debug) {
        console.log(`Finished protecting${downloadOptions.multiple ? `: ${protection._id}` : ''}`);
      }

      if (protection.deprecations) {
        protection.deprecations.forEach(deprecation => {
          if (deprecation.type === 'Transformation') {
            console.warn(
              `Warning: ${deprecation.type} ${deprecation.entity} is no longer maintained. Please consider removing it from your configuration.`
            );
          } else if (deprecation.type && deprecation.entity) {
            console.warn(
              `Warning: ${deprecation.type} ${deprecation.entity} is deprecated.`
            );
          }
        });
      }

      const sourcesErrors = [];

      protection.sources.forEach(s => {
        if (s.isSource && s.errorMessages && s.errorMessages.length > 0) {
          sourcesErrors.push(
            ...s.errorMessages.map(e => ({
              filename: s.filename,
              ...e
            }))
          );
        }
      });

      if (protection.state === 'errored') {
        console.error('Global protection errors:');
        console.error(`- ${protection.errorMessage}`);
        console.error('');
        if (sourcesErrors.length > 0) {
          printSourcesErrors(sourcesErrors);
        }
        throw new Error(`Protection failed. For more information visit: ${APP_URL}.`);
      } else if (sourcesErrors.length > 0) {
        if (protection.bail) {
          printSourcesErrors(sourcesErrors);
          throw new Error('Your protection has failed.');
        } else {
          sourcesErrors.forEach(e =>
            console.warn(`Non-fatal error: "${e.message}" in ${e.filename}`)
          );
        }
      }

      if (!protectionOptions.numberOfProtections || protectionOptions.numberOfProtections === 1) {
        this.handleApplicationProtectionDownload(
          client,
          protection._id,
          downloadOptions,
        );
      }

      return protection._id;
    }


    if (processedProtections.length === 1) {
      return handleProtection(processedProtections[0]);
    }

    for(let i = 0; i < processedProtections.length; i++) {
      const protection = processedProtections[i];
     try {
       await handleProtection(protection)
     } catch(e) {
       console.error(e);
     }
    }

    console.log(`Runtime: ${processedProtections.length} protections in ${Math.round((Date.now() - start) / 1000)}s`);

    return protectionIds;
  },
  /**
   * Handle the download, unzipping, and possible deletion of protections
   * @param {object} client
   * @param {string} instrumentationId
   * @returns {Promise<object>}
   */
  async handleApplicationProtectionDownload(client, protectionId, downloadOptions) {
    const {
      filesDest,
      destCallback,
      stream,
      multiple,
      deleteProtectionOnSuccess,
    } = downloadOptions;
    if (debug) {
      console.log(`Downloading protection ${multiple ? `${protectionId} ` : ''}result`);
    }
    const download = await this.downloadApplicationProtection(
      client,
      protectionId
    );

    errorHandler(download);

    if (debug) {
      console.log(`Unzipping files${multiple ? ` from protection ${protectionId}` : ''}`);
    }
    await unzip(download, (filesDest ? `${filesDest}${multiple ? `/${protectionId}/` : ''}` : filesDest) || destCallback, stream);

    if (debug) {
      console.log(`Finished unzipping files for protection${multiple ? ` ${protectionId}` : ''}`);
    }

    if (!multiple) {
      console.log(protectionId);
    }

    // change this to have the variable that checks if the protection is to be removed
    if (deleteProtectionOnSuccess) {
      await this.removeProtection(client, protectionId, applicationId)
        .then(() => {
          if(debug) {
            console.log('Protection has been successful and will now be deleted')
          }
        })
        .catch((error) => console.error(error));
    }
  },
  /**
   * Instrument and download application sources for profiling purposes
   * @param {object} configPathOrObject
   * @param {function} [destCallback]
   * @returns {Promise<string>}
   */
  async instrumentAndDownload(configPathOrObject, destCallback) {
    const finalConfig = buildFinalConfig(configPathOrObject);

    const {
      applicationId,
      host,
      port,
      basePath,
      protocol,
      cafile,
      keys,
      sources,
      stream = true,
      cwd,
      jscramblerVersion,
      proxy,
      utc,
      skipSources,
      clientId
    } = finalConfig;

    const {accessKey, secretKey} = keys;

    const client = new this.Client({
      accessKey,
      secretKey,
      host,
      port,
      basePath,
      protocol,
      cafile,
      jscramblerVersion,
      proxy,
      utc,
      clientId
    });

    let {filesSrc, filesDest} = finalConfig;

    if (sources) {
      filesSrc = undefined;
    }

    if (destCallback) {
      filesDest = undefined;
    }

    if (!applicationId) {
      throw new Error('Required *applicationId* not provided');
    }

    if (!filesDest && !destCallback) {
      throw new Error('Required *filesDest* not provided');
    }

    if (!skipSources) {
      await this.updateApplicationSources(client, applicationId, {
        sources,
        filesSrc,
        cwd
      });
    } else {
      console.log('Update source files SKIPPED');
    }

    let instrumentation = await this.startInstrumentation(
      client,
      applicationId
    );
    errorHandler(instrumentation);

    const onExitCancelInstrumentation = () => {
      this.deleteProfiling(client, instrumentation.data.id)
        .then(() => console.log('\n** Instrumentation %s WAS CANCELLED **', instrumentation.data.id))
        .catch(() => debug && console.error(e))
        .finally(() => process.exit(1));
    }

    process.once('SIGINT', onExitCancelInstrumentation)
      .once('SIGTERM', onExitCancelInstrumentation);

    instrumentation = await this.pollInstrumentation(
      client,
      instrumentation.data.id
    );

    process.removeListener('SIGINT', onExitCancelInstrumentation).removeListener('SIGTERM', onExitCancelInstrumentation);

    if (debug) {
      console.log(
        `Finished instrumention with id ${instrumentation.data.id}. Downloading...`
      );
    }

    const download = await this.downloadApplicationInstrumented(
      client,
      instrumentation.data.id
    );
    errorHandler(download);

    if (debug) {
      console.log('Unzipping files');
    }

    await unzip(download, filesDest || destCallback, stream);

    if (debug) {
      console.log('Finished unzipping files');
    }

    console.warn(`
      WARNING: DO NOT SEND THIS CODE TO PRODUCTION AS IT IS NOT PROTECTED
    `);

    console.log(
      `Application ${applicationId} was instrumented. Bootstrap your instrumented application and run *--start-profiling* command.`
    );


    return instrumentation.data.id;
  },

  /**
   * Change the profiling run stat.
   * @param configPathOrObject
   * @param state
   * @param label
   * @param {string} nextStepMessage
   * @returns {Promise<string>} The previous state
   */
  async setProfilingState(configPathOrObject, state, label, nextStepMessage) {
    const finalConfig = buildFinalConfig(configPathOrObject);

    const {
      keys,
      host,
      port,
      basePath,
      protocol,
      cafile,
      applicationId,
      proxy,
      utc,
      jscramblerVersion,
      clientId
    } = finalConfig;

    const {accessKey, secretKey} = keys;

    const client = new this.Client({
      accessKey,
      secretKey,
      host,
      port,
      basePath,
      protocol,
      cafile,
      proxy,
      utc,
      jscramblerVersion,
      clientId
    });
    const instrumentation = await client
      .get('/profiling-run', {applicationId})
      .catch(e => {
        if (e.statusCode !== 404) throw e;
      });

    if (!instrumentation) {
      throw new Error(
        'There is no active profiling run. Instrument your application first.'
      );
    }

    const previousState = instrumentation.data.state;
    if (previousState === state) {
      console.log(
        `Profiling was already ${label} for application ${applicationId}. ${nextStepMessage}`
      );
      return;
    }

    await client.patch(`/profiling-run/${instrumentation.data.id}`, {
      state
    });

    console.log(`Profiling was ${label} for application ${applicationId}. ${nextStepMessage}`);
  },

  async downloadSourceMaps(configs, destCallback) {
    const {
      keys,
      host,
      port,
      basePath,
      protocol,
      cafile,
      stream = true,
      filesDest,
      filesSrc,
      protectionId,
      jscramblerVersion,
      utc,
      proxy
    } = configs;

    const {accessKey, secretKey} = keys;

    const client = new this.Client({
      accessKey,
      secretKey,
      host,
      port,
      basePath,
      protocol,
      cafile,
      jscramblerVersion,
      utc,
      proxy
    });

    if (!filesDest && !destCallback) {
      throw new Error('Required *filesDest* not provided');
    }

    if (!protectionId) {
      throw new Error('Required *protectionId* not provided');
    }

    if (filesSrc) {
      console.warn(
        '[Warning] Ignoring sources supplied. Downloading source maps of given protection'
      );
    }
    let download;
    try {
      download = await this.downloadSourceMapsRequest(client, protectionId);
    } catch (e) {
      errorHandler(e);
    }
    await unzip(download, filesDest || destCallback, stream);
  },
  async downloadSymbolTable(configs, destCallback) {
    const {
      keys,
      host,
      port,
      basePath,
      protocol,
      cafile,
      stream = true,
      filesDest,
      filesSrc,
      protectionId,
      jscramblerVersion,
      utc,
      proxy
    } = configs;

    const {accessKey, secretKey} = keys;

    const client = new this.Client({
      accessKey,
      secretKey,
      host,
      port,
      basePath,
      protocol,
      cafile,
      jscramblerVersion,
      utc,
      proxy
    });

    if (!filesDest && !destCallback) {
      throw new Error('Required *filesDest* not provided');
    }

    if (!protectionId) {
      throw new Error('Required *protectionId* not provided');
    }

    if (filesSrc) {
      console.warn(
        '[Warning] Ignoring sources supplied. Downloading symbol table of given protection'
      );
    }
    let download;
    try {
      download = await this.downloadSymbolTableRequest(client, protectionId);
    } catch (e) {
      errorHandler(e);
    }

    if (typeof destCallback === 'function') {
      destCallback(download, filesDest);
    } else {
      await fs.promises.mkdir(filesDest, { recursive: true });
      await fs.promises.writeFile(
        path.join(filesDest, `${protectionId}_symbolTable.json`),
        download
      );
    }
  },
  /**
   * Polls a instrumentation every POLLING_INTERVALms until the state be equal to
   * FINISHED_INSTRUMENTATION, FAILED_INSTRUMENTATION or DELETED
   * @param {object} client
   * @param {string} instrumentationId
   * @returns {Promise<object>}
   * @throws {Error} due to errors in instrumentation process or user cancel the operation
   */
  async pollInstrumentation(client, instrumentationId) {
    const start = Date.now();
    const poll = async () => {
      const instrumentation = await this.getInstrumentation(
        client,
        instrumentationId
      );
      switch (instrumentation.data.state) {
        case 'DELETED':
          throw new Error('Protection canceled by user');
        case 'FAILED_INSTRUMENTATION':
          instrumentation.errors = instrumentation.errors.concat(
            instrumentation.data.instrumentationErrors.map(e => ({
              message: `${e.message} at ${e.fileName}:${e.lineNumber}`
            }))
          );
          return errorHandler(instrumentation);
        case 'FINISHED_INSTRUMENTATION':
          return instrumentation;
        default:
          await new Promise(resolve => setTimeout(resolve, getPollingInterval(start)));
          return poll();
      }
    };
    return poll();
  },
  async withRetries(action) {
    let retriesLeft = config.maxRetries;
    for (;;) {
      try {
        return await action();
      } catch (e) {
        if (retriesLeft <= 0) {
          throw e;
        }
        if (
          e.statusCode !== HTTP_STATUS_CODES.SERVICE_UNAVAILABLE &&
          e.statusCode !== HTTP_STATUS_CODES.GATEWAY_TIMEOUT
        ) {
          throw e;
        }
        // Retry
        if (debug) {
          console.log('Retrying request');
        }
        retriesLeft--;
      }
    }
  },
  async pollProtection(client, applicationId, protectionId, fragments) {
    const start = Date.now();
    const poll = async () => {
      const applicationProtection = await this.withRetries(
        () => this.getApplicationProtection(
          client,
          applicationId,
          protectionId,
          fragments
        )
      );
      if (applicationProtection.errors) {
        console.log('Error polling protection', applicationProtection.errors);

        throw new Error(
          `Protection failed. For more information visit: ${APP_URL}.`
        );
      } else {
        const {state} = applicationProtection.data.applicationProtection;
        if (
          state !== 'finished' &&
          state !== 'errored' &&
          state !== 'canceled'
        ) {
          await new Promise(resolve => setTimeout(resolve, getPollingInterval(start)));
          return poll();
        } else if (state === 'canceled') {
          throw new Error('Protection canceled by user');
        } else {
          return applicationProtection.data.applicationProtection;
        }
      }
    };

    return poll();
  },
  async pollProtections(client, applicationId, protectionIds, fragments, downloadOptions) {
    if (protectionIds.length === 1) {
      return [await this.pollProtection(client, applicationId, protectionIds[0], fragments)];
    }

    const start = Date.now();
    let seen = {};
    const poll = async () => {
      const applicationProtections = await this.withRetries(
        () => this.getApplicationProtections(
          client,
          applicationId,
          {protectionIds},
          fragments.applicationProtection,
          ["$protectionIds: [String]"]
        )
      );

      if (applicationProtections.errors) {
        console.log('Error polling protection', applicationProtections.errors);

        throw new Error(
          `Protection failed. For more information visit: ${APP_URL}.`
        );
      } else {
        const ended = applicationProtections.data.applicationProtections.filter(({state}) =>
          state === 'finished' ||
          state === 'errored' ||
          state === 'canceled'
        );
        // print progress
        ended.filter(({_id, state}) => !seen[_id] && state !== 'canceled').forEach(async ({_id, startedAt, finishedAt, state}) => {
          seen[_id] = true;
          console.log(`[${Object.keys(seen).length}/${protectionIds.length}] Protection=${_id}, state=${state}, build-time=${Math.round((new Date(finishedAt) - new Date(startedAt)) / 1000)}s`);
          await this.handleApplicationProtectionDownload(client, _id, downloadOptions);
          console.log(`Downloaded: ${_id}`);
        })
        if (ended.length < protectionIds.length) {
          await new Promise(resolve => setTimeout(resolve, getPollingInterval(start)));
          return poll();
        }
        return applicationProtections.data.applicationProtections;
      }
    };

    return poll();
  },
  //
  async createApplication(client, data, fragments) {
    return client.post(
      '/application',
      mutations.createApplication(data, fragments)
    );
  },
  //
  async duplicateApplication(client, data, fragments) {
    return client.post(
      '/application',
      mutations.duplicateApplication(data, fragments)
    );
  },
  //
  async removeApplication(client, id) {
    return client.post('/application', mutations.removeApplication(id));
  },
  //
  async removeProtection(client, id, appId, fragments) {
    return client.post(
      '/application',
      mutations.removeProtection(id, appId, fragments)
    );
  },
  //
  async cancelProtection(client, id, appId, fragments) {
    const mutation = await mutations.cancelProtection(id, appId, fragments);
    return client.post('/application', mutation);
  },
  //
  async updateApplication(client, applicationData, fragments, applicationId) {
    const mutation = await mutations.updateApplication(applicationData, fragments, applicationId);
    return client.post('/application', mutation);
  },
  //
  async unlockApplication(client, application, fragments) {
    const mutation = await mutations.unlockApplication(application, fragments);
    return client.post('/application', mutation);
  },
  //
  async getApplication(client, applicationId, fragments, params) {
    const query = await queries.getApplication(
      applicationId,
      fragments,
      params
    );
    return client.get('/application', query);
  },
  //
  async getApplicationSource(client, sourceId, fragments, limits) {
    const query = await queries.getApplicationSource(
      sourceId,
      fragments,
      limits
    );
    return client.get('/application', query);
  },
  //
  async getApplicationProtections(client, applicationId, params, fragments, queryArgs) {
    const query = queries.getApplicationProtections(
      applicationId,
      params,
      fragments,
      queryArgs
    );
    return client.get('/application', query);
  },
  //
  async getApplicationProtectionsCount(client, applicationId, fragments) {
    const query = await queries.getApplicationProtectionsCount(
      applicationId,
      fragments
    );
    return client.get('/application', query);
  },
  //
  async createTemplate(client, template, fragments) {
    const mutation = await mutations.createTemplate(template, fragments);
    return client.post('/application', mutation);
  },
  //
  async removeTemplate(client, id) {
    const mutation = await mutations.removeTemplate(id);
    return client.post('/application', mutation);
  },
  //
  async getTemplates(client, fragments) {
    const query = await queries.getTemplates(fragments);
    return client.get('/application', query);
  },
  //
  async getApplications(client, fragments, params) {
    const query = await queries.getApplications(fragments, params);
    return client.get('/application', query);
  },
  //
  async addApplicationSource(
    client,
    applicationId,
    applicationSource,
    fragments
  ) {
    const mutation = await mutations.addApplicationSource(
      applicationId,
      applicationSource,
      fragments
    );
    return this.withRetries(
      () => client.post('/application', mutation)
    );
  },
  //
  async addApplicationSourceFromURL(client, applicationId, url, fragments) {
    const file = await getFileFromUrl(client, url);
    const mutation = await mutations.addApplicationSource(
      applicationId,
      file,
      fragments
    );

    return client.post('/application', mutation);
  },
  //
  async updateApplicationSource(client, applicationSource, fragments) {
    const mutation = await mutations.updateApplicationSource(
      applicationSource,
      fragments
    );
    return client.post('/application', mutation);
  },
  //
  async removeSourceFromApplication(
    client,
    sourceId,
    applicationId,
    fragments
  ) {
    const mutation = await mutations.removeSourceFromApplication(
      sourceId,
      applicationId,
      fragments
    );
    return this.withRetries(
      () => client.post('/application', mutation)
    );
  },
  //
  async applyTemplate(client, templateId, appId, fragments) {
    const mutation = await mutations.applyTemplate(
      templateId,
      appId,
      fragments
    );
    return client.post('/application', mutation);
  },
  //
  async updateTemplate(client, template, fragments) {
    const mutation = await mutations.updateTemplate(template, fragments);
    return client.post('/application', mutation);
  },
  async getApplicationProfiling(client, applicationId) {
    return client.get('/profiling-run', {applicationId});
  },
  async deleteProfiling(client, profilingId) {
    return client.patch(`/profiling-run/${profilingId}`, {
      state: 'DELETED'
    });
  },
  /**
   * Starts a new instrumentation process.
   * Previous instrumentation must be deleted, before starting a new one.
   * @param client
   * @param applicationId
   * @returns {Promise<*>}
   */
  async startInstrumentation(client, applicationId) {
    const instrumentation = await this.getApplicationProfiling(
      client,
      applicationId
    ).catch(e => {
      if (e.statusCode !== 404) throw e;
    });

    if (instrumentation) {
      await this.deleteProfiling(client, instrumentation.data.id);
    }
    return client.post('/profiling-run', {applicationId});
  },
  //
  async createApplicationProtection(
    client,
    applicationId,
    protectionOptions,
    fragments
  ) {
    const {args} = await introspection.mutation(
      client,
      'createApplicationProtection'
    );

    const mutation = await mutations.createApplicationProtection(
      applicationId,
      fragments,
      protectionOptions,
      args
    );

    return client.post('/application', mutation);
  },
  /**
   * Create one or more application protections at once
   * @param {JscramblerClient} client
   * @param {string} applicationId
   * @param {object} protectionOptions
   * @param {number} [protectionOptions.numberOfProtections]
   * @param {object} fragments
   * @returns {Promise<{data: {protections: Array.<{_id}>}, errors: Array}>}
   */
  async createApplicationProtections(
    client,
    applicationId,
    protectionOptions,
    fragments
  ) {
    let result;
    if (!protectionOptions.numberOfProtections || protectionOptions.numberOfProtections < 2) {
      result = await this.createApplicationProtection(client, applicationId, {...protectionOptions, numberOfProtections: undefined}, fragments);
      if (result.data && result.data.createApplicationProtection) {
        result.data.protections = [result.data.createApplicationProtection];
        delete result.data.createApplicationProtection;
      }
    } else {
      const mutationType = await introspection.mutation(
        client,
        'createApplicationProtections'
      );

      if (!mutationType) {
        console.error(
          `"Create multiple protections at once" it's only available on Jscrambler version 7.2 and above.`
        );
        process.exit(1);
      }

      const mutation = await mutations.createApplicationProtections(
        applicationId,
        fragments,
        protectionOptions,
        mutationType.args
      );

      result = await client.post('/application', mutation);
      if (result.data && result.data.createApplicationProtections) {
        result.data.protections = result.data.createApplicationProtections.protections;
        delete result.data.createApplicationProtections;
      }
    }
    return result;
  },
  /**
   * @param {object} client
   * @param {string} instrumentationId
   * @returns {Promise<object>}
   */
  async getInstrumentation(client, instrumentationId) {
    return client.get(`/profiling-run/${instrumentationId}`);
  },
  //
  async getApplicationProtection(
    client,
    applicationId,
    protectionId,
    fragments
  ) {
    const query = await queries.getProtection(
      applicationId,
      protectionId,
      fragments
    );
    return client.get('/application', query);
  },
  //
  async downloadSourceMapsRequest(client, protectionId) {
    return client.get(`/application/sourceMaps/${protectionId}`, null, false);
  },
  async downloadSymbolTableRequest(client, protectionId) {
    return client.get(`/application/symbolTable/${protectionId}`, null, false);
  },
  //
  async downloadApplicationProtection(client, protectionId) {
    return client.get(`/application/download/${protectionId}`, null, false);
  },
  /**
   * @param {object} client
   * @param {string} instrumentationId
   * @returns {*}
   */
  downloadApplicationInstrumented(client, instrumentationId) {
    return client.get(
      `/profiling-run/${instrumentationId}/instrumented-bundle`,
      null,
      false
    );
  },
  /**
   * Introspect method to check if a certain field is supported.
   * @param {Object} config jscrambler client config
   * @param {String} queryOrMutation a string in ['query, 'mutation']
   * @param {String} methodName query or mutation name
   * @param {String} field args field to introspect
   * @returns {Boolean} true if the field is supported, false otherwise
   */
  async introspectFieldOnMethod(config, queryOrMutation, methodName, field) {
    const instrospectionType = queryOrMutation.toLowerCase() === 'mutation' ? introspection.mutation : introspection.query;

    const client = new this.Client({
      ...config
    });

    const result = await instrospectionType(
      client,
      methodName
    );

    if (!result || !result.args) {
      debug && console.log(`Method *${methodName}* not found.`)
      return false;
    }

    const dataArg = result.args.find(arg => arg.name === 'data');
    const isFieldSupported = dataArg && dataArg.type.inputFields.some(e => e.name === field);

    return isFieldSupported;
  },
  async getProtectionMetadata(conf, protectionId, outputDir) {
    const INVALID_PARAMETERS = ['original', 'initialCleanup', 'wrapUp'];
    const finalConfig = buildFinalConfig(conf);

    const {
      applicationId,
      host,
      port,
      basePath,
      protocol,
      cafile,
      keys,
      jscramblerVersion,
      proxy,
      utc,
      clientId,
    } = finalConfig;

    const { accessKey, secretKey } = keys;

    const client = new this.Client({
      accessKey,
      secretKey,
      host,
      port,
      basePath,
      protocol,
      cafile,
      jscramblerVersion,
      proxy,
      utc,
      clientId,
    });

    const appSource = await getIntrospection(client, 'ApplicationSource');

    if (
      !appSource.fields.some(({ name }) => name === 'transformedContentHash')
    ) {
      console.error(
        `"Protection report" it's only available on Jscrambler version 8.4 and above.`,
      );
      process.exit(1);
    }

    const response = await this.getApplicationProtection(
      client,
      applicationId,
      protectionId,
      {
        application: '_id',
        applicationProtection:
          '_id, applicationId, parameters, version, areSubscribersOrdered, useRecommendedOrder, tolerateMinification, profilingDataMode, useAppClassification, browsers, sourceMaps, sources { filename, transformedContentHash, metrics { transformation } }',
      },
    );

    errorHandler(response);

    const sourcesInfo = response.data.applicationProtection.sources.map(
      (source) => {
        const parameters = source.metrics.filter(
          (metric) => !INVALID_PARAMETERS.includes(metric.transformation),
        );

        return {
          filename: source.filename,
          sha256Checksum: source.transformedContentHash,
          parameters: parameters.map((param) => param.transformation),
        };
      },
    );

    const metadataJson = JSON.stringify(
      {
        applicationId: response.data.applicationProtection.applicationId,
        // eslint-disable-next-line no-underscore-dangle
        protectionId: response.data.applicationProtection._id,
        jscramblerVersion: response.data.applicationProtection.version,
        areSubscribersOrdered:
          response.data.applicationProtection.areSubscribersOrdered,
        useRecommendedOrder:
          response.data.applicationProtection.useRecommendedOrder,
        tolerateMinification:
          response.data.applicationProtection.tolerateMinification,
        profilingDataMode:
          response.data.applicationProtection.profilingDataMode,
        useAppClassification:
          response.data.applicationProtection.useAppClassification,
        browsers: response.data.applicationProtection.browsers,
        sourceMaps: response.data.applicationProtection.sourceMaps,
        parameters: response.data.applicationProtection.parameters,
        sources: sourcesInfo,
      },
      null,
      2,
    );

    if (outputDir) {
      await fs.promises.writeFile(outputDir, metadataJson);
      console.log(`Protection Report ${protectionId} saved in ${outputDir}`);
    } else {
      console.log(metadataJson);
    }
  },

  async getBalance(conf) {
    const finalConfig = buildFinalConfig(conf);

    const {
      host,
      port,
      basePath,
      protocol,
      cafile,
      keys,
      jscramblerVersion,
      proxy,
      utc,
      clientId,
    } = finalConfig;

    const { accessKey, secretKey } = keys;

    const client = new this.Client({
      accessKey,
      secretKey,
      host,
      port,
      basePath,
      protocol,
      cafile,
      jscramblerVersion,
      proxy,
      utc,
      clientId,
    });
    const balance = await client.get('/balance');

    console.log(balance);

    return balance;
  },
};

function getFileFromUrl(client, url) {
  return request.get(url).then(res => ({
    content: res.data,
    filename: path.basename(url),
    extension: path.extname(url).substr(1)
  }));
}
