import 'babel-polyfill';

import glob from 'glob';
import path from 'path';
import request from 'axios';
import defaults from 'lodash.defaults';
import Q from 'q';

import config from './config';
import generateSignedParams from './generate-signed-params';
import JscramblerClient from './client';
import * as mutations from './mutations';
import * as queries from './queries';
import {zip, zipSources, unzip} from './zip';
import * as introspection from './introspection';

import getProtectionDefaultFragments from './get-protection-default-fragments';

const {intoObjectType} = introspection;

const debug = !!process.env.DEBUG;

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

export default {
  Client: JscramblerClient,
  config,
  generateSignedParams,
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
  //   "port": "443"
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
    const _config =
      typeof configPathOrObject === 'string'
        ? require(configPathOrObject)
        : configPathOrObject;

    const finalConfig = defaults(_config, config);

    const {
      applicationId,
      host,
      port,
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
      bail,
      jscramblerVersion,
      debugMode
    } = finalConfig;

    const {accessKey, secretKey} = keys;

    const client = new this.Client({
      accessKey,
      secretKey,
      host,
      port,
      protocol,
      cafile,
      jscramblerVersion
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

    if (sources || (filesSrc && filesSrc.length)) {
      const removeSourceRes = await this.removeSourceFromApplication(
        client,
        '',
        applicationId
      );
      if (removeSourceRes.errors) {
        // TODO Implement error codes or fix this is on the services
        let hadNoSources = false;
        removeSourceRes.errors.forEach(error => {
          if (
            error.message ===
            'Application Source with the given ID does not exist'
          ) {
            hadNoSources = true;
          }
        });
        if (!hadNoSources) {
          throw new Error(removeSourceRes.errors[0].message);
        }
      }
    }

    let zipped;

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

      await this.addApplicationSource(client, applicationId, {
        content,
        filename: 'application.zip',
        extension: 'zip'
      });
    }

    const updateData = {
      _id: applicationId,
      debugMode: !!debugMode
    };

    if (params && Object.keys(params).length) {
      updateData.parameters = normalizeParameters(params);
      updateData.areSubscribersOrdered = Array.isArray(params);
    }

    if (typeof areSubscribersOrdered !== 'undefined') {
      updateData.areSubscribersOrdered = areSubscribersOrdered;
    }

    if (applicationTypes) {
      updateData.applicationTypes = applicationTypes;
    }

    if (typeof useRecommendedOrder !== 'undefined') {
      updateData.useRecommendedOrder = useRecommendedOrder;
    }

    if (languageSpecifications) {
      updateData.languageSpecifications = languageSpecifications;
    }

    if (typeof sourceMaps !== 'undefined') {
      updateData.sourceMaps = sourceMaps;
    }

    if (
      updateData.parameters ||
      updateData.applicationTypes ||
      updateData.languageSpecifications ||
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

    const createApplicationProtectionRes = await this.createApplicationProtection(
      client,
      applicationId,
      {bail, randomizationSeed}
    );
    errorHandler(createApplicationProtectionRes);

    const protectionId =
      createApplicationProtectionRes.data.createApplicationProtection._id;
    const protection = await this.pollProtection(
      client,
      applicationId,
      protectionId,
      await getProtectionDefaultFragments(client)
    );

    if (debug) {
      console.log('Finished protecting');
    }

    const errors = protection.errorMessage
      ? [{message: protection.errorMessage}]
      : [];
    protection.sources.forEach(s => {
      if (s.errorMessages && s.errorMessages.length > 0) {
        errors.push(
          ...s.errorMessages.map(e => ({
            filename: s.filename,
            ...e
          }))
        );
      }
    });

    if (!bail && errors.length > 0) {
      errors.forEach(e =>
        console.error(`Non-fatal error: "${e.message}" in ${e.filename}`)
      );
    } else if (bail && protection.state === 'errored') {
      errors.forEach(e =>
        console.error(
          `Error: "${e.message}"${e.filename
            ? `in ${e.filename}${e.line ? `:${e.line}` : ''}`
            : ''}`
        )
      );
      throw new Error('Protection failed');
    }

    if (protection.deprecations) {
      protection.deprecations.forEach(deprecation => {
        if (deprecation.type === 'Transformation') {
          console.warn(
            `Warning: ${deprecation.type} ${deprecation.entity} is no longer maintained. Please consider removing it from your configuration.`
          );
        } else {
          console.warn(
            `Warning: ${deprecation.type} ${deprecation.entity} is deprecated.`
          );
        }
      });
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

  async downloadSourceMaps(configs, destCallback) {
    const {
      keys,
      host,
      port,
      protocol,
      cafile,
      stream = true,
      filesDest,
      filesSrc,
      protectionId
    } = configs;

    const {accessKey, secretKey} = keys;

    const client = new this.Client({
      accessKey,
      secretKey,
      host,
      port,
      protocol,
      cafile
    });

    if (!filesDest && !destCallback) {
      throw new Error('Required *filesDest* not provided');
    }

    if (!protectionId) {
      throw new Error('Required *protectionId* not provided');
    }

    if (filesSrc) {
      console.log(
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

  async pollProtection(client, applicationId, protectionId, fragments) {
    const poll = async () => {
      const applicationProtection = await this.getApplicationProtection(
        client,
        applicationId,
        protectionId,
        fragments
      );
      const url = `https://app.jscrambler.com/app/${applicationId}/protections/${protectionId}`;
      if (applicationProtection.errors) {
        console.log('Error polling protection', applicationProtection.errors);

        throw new Error(
          `Protection failed. For more information visit: ${url}`
        );
      } else {
        const state = applicationProtection.data.applicationProtection.state;
        const bail = applicationProtection.data.applicationProtection.bail;
        if (
          state !== 'finished' &&
          state !== 'errored' &&
          state !== 'canceled'
        ) {
          await new Promise(resolve => setTimeout(resolve, 500));
          return poll();
        } else if (state === 'errored' && !bail) {
          throw new Error(
            `Protection failed. For more information visit: ${url}`
          );
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
    return client.post('/application', mutation);
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
    return client.post('/application', mutation);
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
  //
  async createApplicationProtection(
    client,
    applicationId,
    protectionOptions
  ) {
    const {args} = await introspection.mutation(
      client,
      'createApplicationProtection'
    );

    const mutation = await mutations.createApplicationProtection(
      applicationId,
      undefined,
      protectionOptions,
      args
    );

    return client.post('/application', mutation);
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
  //
  async downloadApplicationProtection(client, protectionId) {
    return client.get(`/application/download/${protectionId}`, null, false);
  }
};

function getFileFromUrl(client, url) {
  return request.get(url).then(res => ({
    content: res.data,
    filename: path.basename(url),
    extension: path.extname(url).substr(1)
  }));
}
