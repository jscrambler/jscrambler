/* eslint-disable no-console */
import 'babel-polyfill';

import glob from 'glob';
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
import {zip, zipSources, unzip, outputFileSync} from './zip';
import * as introspection from './introspection';

import getProtectionDefaultFragments from './get-protection-default-fragments';

const {intoObjectType} = introspection;

const debug = !!process.env.DEBUG;
const APP_URL = 'https://app.jscrambler.com';
const POLLING_MIN_INTERVAL = 1000;
const POLLING_MAX_INTERVAL = 10000;
const INCREASE_POLL_INTERVAL_EVERY = 30000;

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
  console.error('Application sources errors:');
  console.error(JSON.stringify(errors, null, 2));
  console.error('');
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
  generateSignedParams,
  /**
   * Remove and Add application sources
   * @param {object} client
   * @param {string} applicationId
   * @param {{
   *  sources: Array.<{filename: string, content: string}>,
   *  filesSrc: Array.<string>,
   *  cwd: string,
   *  appProfiling: ?object
   * }} opts
   * @returns {Promise<{extension: string, filename: string, content: *}>}
   */
  async updateApplicationSources(
    client,
    applicationId,
    {sources, filesSrc, cwd, appProfiling}
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
        applicationId
      );

      errorHandler(removeSourceRes);
    }

    let zipped;
    let source;

    if (filesSrc && filesSrc.length) {
      let _filesSrc = [];
      for (let i = 0, l = filesSrc.length; i < l; i += 1) {
        if (typeof filesSrc[i] === 'string') {
          // TODO Replace `glob.sync` with async version
          _filesSrc = _filesSrc.concat(
            glob.sync(filesSrc[i], {
              dot: true
            })
          );
        } else {
          _filesSrc.push(filesSrc[i]);
        }
      }

      if (debug) {
        console.log('Creating zip from source files');
      }

      zipped = await zip(_filesSrc, cwd);
    } else if (sources) {
      if (debug) {
        console.log('Creating zip from sources');
      }

      zipped = await zipSources(sources);
    }

    if (zipped) {
      const content = zipped
        .generate({
          type: 'nodebuffer'
        })
        .toString('base64');

      if (debug) {
        console.log('Adding sources to application');
      }

      source = {
        content,
        filename: 'application.zip',
        extension: 'zip'
      };

      errorHandler(
        await this.addApplicationSource(client, applicationId, source)
      );
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
      forceAppEnvironment
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
        if (![
          HTTP_STATUS_CODES.NOT_FOUND,
          HTTP_STATUS_CODES.FORBIDDEN,
          HTTP_STATUS_CODES.SERVICE_UNAVAILABLE
        ].includes(e.statusCode)) throw e;
      });

      if (appProfiling && removeProfilingData) {
        await this.deleteProfiling(client, appProfiling.data.id);
        appProfiling.data.state = 'DELETED';
      }

      source = await this.updateApplicationSources(client, applicationId, {
        sources,
        filesSrc,
        cwd,
        appProfiling
      });
    } else {
      console.log('Update source files SKIPPED');
    }

    const updateData = {
      _id: applicationId,
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
      useProfilingData,
      useRecommendedOrder
    };

    for (const prop in dataToValidate) {
      const value = dataToValidate[prop];
      if (typeof value !== 'undefined') {
        updateData[prop] = value;
      }
    }

    if (
      updateData.parameters ||
      updateData.applicationTypes ||
      updateData.languageSpecifications ||
      updateData.browsers ||
      typeof updateData.areSubscribersOrdered !== 'undefined'
    ) {
      if (debug) {
        console.log('Updating parameters of protection');
      }

      const applicationUpdate = await intoObjectType(
        client,
        updateData,
        'Application'
      );
      const updateApplicationRes = await this.updateApplication(
        client,
        applicationUpdate
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

    delete updateData._id;
    const protectionOptions = {
      ...updateData,
      bail,
      entryPoint,
      excludeList,
      inputSymbolTable,
      randomizationSeed,
      source,
      tolerateMinification,
      forceAppEnvironment
    };

    if (finalConfig.inputSymbolTable) {
      // Note: we can not use the fs.promises API because some users may not have node 10.
      // Once node 10 is old enough to be safe to assume that all users will have it, this
      // should be safe to replace with `await fs.promises.readFile`.
      const inputSymbolTableContents = fs.readFileSync(finalConfig.inputSymbolTable, 'utf-8');
      protectionOptions.inputSymbolTable = inputSymbolTableContents;
    }

    const createApplicationProtectionRes = await this.createApplicationProtection(
      client,
      applicationId,
      protectionOptions
    );
    errorHandler(createApplicationProtectionRes);

    const protectionId =
      createApplicationProtectionRes.data.createApplicationProtection._id;

    const onExitCancelProtection = () => {
      this.cancelProtection(client, protectionId, applicationId)
        .then(() => console.log('\n** Protection %s WAS CANCELLED **', protectionId))
        .catch(() => debug && console.error(e))
        .finally(() => process.exit(0));
    }

    process.once('SIGINT', onExitCancelProtection)
      .once('SIGTERM', onExitCancelProtection);

    const protection = await this.pollProtection(
      client,
      applicationId,
      protectionId,
      await getProtectionDefaultFragments(client)
    );

    process.removeListener('SIGINT', onExitCancelProtection).removeListener('SIGTERM', onExitCancelProtection);

    if (protection.growthWarning) {
      console.warn(`Warning: Your protected application has surpassed a reasonable file growth.\nFor more information on what might have caused this, please see the Protection Report.\nLink: ${APP_URL}.`);
    }
    if (debug) {
      console.log('Finished protecting');
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
      if (s.errorMessages && s.errorMessages.length > 0) {
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

    if (debug) {
      console.log('Downloading protection result');
    }
    const download = await this.downloadApplicationProtection(
      client,
      protectionId
    );

    errorHandler(download);

    if (debug) {
      console.log('Unzipping files');
    }

    unzip(download, filesDest || destCallback, stream);

    if (debug) {
      console.log('Finished unzipping files');
    }

    console.log(protectionId);

    return protectionId;
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
        .finally(() => process.exit(0));
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

    unzip(download, filesDest || destCallback, stream);

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
    unzip(download, filesDest || destCallback, stream);
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
      outputFileSync(
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
  async updateApplication(client, application, fragments) {
    const mutation = await mutations.updateApplication(application, fragments);
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
  async getApplicationProtections(client, applicationId, params, fragments) {
    const query = await queries.getApplicationProtections(
      applicationId,
      params,
      fragments
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
  }
};

function getFileFromUrl(client, url) {
  return request.get(url).then(res => ({
    content: res.data,
    filename: path.basename(url),
    extension: path.extname(url).substr(1)
  }));
}
