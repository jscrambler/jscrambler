import defaults from 'lodash.defaults';
import fs from 'fs';
import keys from 'lodash.keys';
import axios from 'axios';
import {gzipSync} from 'zlib';
import url from 'url';
import https from 'https';
import http from 'http';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

import cfg from './config';
import generateSignedParams from './generate-signed-params';
import {
  JSCRAMBLER_ERROR_CODES,
  HTTP_STATUS_CODES,
  CLIENT_IDS,
  CLIENT_PACKAGES
} from './constants';
import {version} from '../package.json';

const debug = !!process.env.DEBUG;
const metrics = !!process.env.METRICS;
const noCompression = !!process.env.NO_COMPRESSION;

class ClientError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

/**
 * @class JScramblerClient
 * @param {Object} options
 * @param {String} options.accessKey
 * @param {String} options.secretKey
 * @param {String} [options.host=api.jscrambler.com]
 * @param {String} [options.port=443]
 * @param {String} [options.basePath]
 * @param {String} [options.clientId=0]
 * @author Jscrambler
 * @license MIT <http://opensource.org/licenses/MIT>
 */

function JScramblerClient(options) {
  // Sluggish hack for backwards compatibility
  if (options && !options.keys && (options.accessKey || options.secretKey)) {
    options.keys = {};
    options.keys.accessKey = options.accessKey;
    options.keys.secretKey = options.secretKey;
  }

  options.keys = defaults(options.keys || {}, cfg.keys);

  /**
   * @member
   */
  this.options = defaults(options || {}, cfg);

  const {jscramblerVersion, clientId} = this.options;

  this.axiosInstance = axios.create({
    headers: {
      jscramblerVersion,
      clientId
    },
    transformRequest: axios.defaults.transformRequest.concat(
      function (data, headers) {
        // gzip request with more than 1KiB
        if (!noCompression && typeof data === 'string' && data.length > 1024) {
          headers['Content-Encoding'] = 'gzip';
          data = gzipSync(data);
          if (metrics) {
            process.stdout.write(`[gzip ${data.length}B] `);
          }
        }
        return data;
      }
    ),
  });
}
/**
 * Delete request.
 * @param {String} path
 * @param {Object} params
 * @param {Callback} callback
 */
JScramblerClient.prototype.delete = function(path, params) {
  return this.request('DELETE', path, params);
};
/**
 * Get request.
 * @param {String} path
 * @param {Object} params
 * @param {Callback} callback
 */
JScramblerClient.prototype.get = function(
  path,
  params,
  isJSON = true
) {
  return this.request('GET', path, params, isJSON);
};
/**
 * HTTP request.
 * @param {String} method
 * @param {String} path
 * @param {Object} params
 * @param {Callback} callback
 */
JScramblerClient.prototype.request = function(
  method,
  path,
  params = {},
  isJSON = true
) {
  let signedData;
  if (this.options.useHeaderAuth) {
    if (!this.token) {
      throw new Error(
        'Generating auth token when useHeaderAuth === true is not yet supported. You need to set the jscramblerClient token property explicitly.'
      );
    }
  } else {
    if (this.token) {
      params.token = this.token;
    } else {
      if (!this.options.keys.accessKey) {
        throw new Error('Required *accessKey* not provided');
      }

      if (!this.options.keys.secretKey) {
        throw new Error('Required *secretKey* not provided');
      }
    }
  }

  const _keys = keys(params);
  for (let i = 0, l = _keys.length; i < l; i++) {
    if (params[_keys[i]] instanceof Array) {
      params[_keys[i]] = params[_keys[i]].join(',');
    }
  }

  // If post sign data and set the request as multipart
  if (this.options.keys.accessKey && this.options.keys.secretKey) {
    signedData = generateSignedParams(
      method,
      path,
      this.options.host,
      this.options.keys,
      params,
      this.options.utc
    );
  } else {
    signedData = params;
  }

  let { protocol, port, proxy } = this.options;

  if (!port && !protocol) {
    port = 443;
    protocol = 'https';
  }

  if (!port) {
    port = protocol === 'https' ? 443 : 80;
  }

  if (!protocol) {
    protocol = port === 443 ? 'https' : 'http';
  }

  const formattedUrl =
    url.format({
      hostname: this.options.host,
      port,
      pathname: this.options.basePath + path,
      protocol
    });

  let data;
  const settings = {};

  // Internal CA
  let agentOptions = {};
  if (this.options.cafile) {
    agentOptions = {
      ca: fs.readFileSync(this.options.cafile)
    }
  }

  if (proxy || typeof proxy === 'object') {
    const { host, port = 8080, auth } = proxy;

    if (!host) {
      throw new Error('Required *proxy.host* not provided');
    }

    let username;
    let password;
    if (auth) {
      ({ username, password } = auth);

      if (!username || !password) {
        throw new Error(
          'Required *proxy.auth* username or/and password not provided',
        );
      }
    }

    settings.proxy = false;
    const proxyConfig = {
      host,
      port,
      username,
      password,
      protocol: `${proxy.protocol || 'http'}:`,
    };
    settings.httpsAgent = new HttpsProxyAgent(proxyConfig, agentOptions);
    settings.httpAgent = new HttpProxyAgent(proxyConfig, agentOptions);
  } else if (agentOptions) {
    settings.httpsAgent = new https.Agent(agentOptions);
    settings.httpAgent = new http.Agent(agentOptions);
  }

  if (!isJSON) {
    settings.responseType = 'arraybuffer';
  }

  let promise;

  if (method === 'GET' || method === 'DELETE') {
    settings.params = signedData;
    promise = this.axiosInstance[method.toLowerCase()](formattedUrl, settings);
  } else {
    data = signedData;
    promise = this.axiosInstance[method.toLowerCase()](
      formattedUrl,
      data,
      settings,
    );
  }

  const start = Date.now();
  return promise.then(res => {
    if (metrics || debug) {
      console.log(`${method} ${path} ${((data || settings.params).query || '').split('(')[0].trim().replace(' ', '-')} ${JSON.stringify(data || settings.params).length}B ${Date.now() - start}ms`);
    }
    return res.data;
  }).catch(err => {
    let errorMessage = 'Unexpected Response: ';
    let statusCode = 500;

    if (err.response) {
      if (debug) {
        console.error(err.response);
      }

      errorMessage += `${err.response.status} ${err.response.statusText}`;
      statusCode = err.response.status;

      let incompatibleApi = false;
      if (statusCode === HTTP_STATUS_CODES.UNAUTHORIZED && /Invalid Signature/i.test(err.response.data.message)) {
        incompatibleApi = err.response.data.errorCode !== JSCRAMBLER_ERROR_CODES.INVALID_SIGNATURE;
      }

      if (incompatibleApi) {
          errorMessage = `Incompatible jscrambler CLI version (${version}). Please downgrade to: \n\t$ npm install ${
            CLIENT_PACKAGES[this.options.clientId]
          }@5`;
      } else if (
        // For when we have API error messages
        err.response.data &&
        err.response.data.error &&
        err.response.data.message
      ) {
        errorMessage += ` - ${err.response.data.message}`;
      } else if (
        err.response.data &&
        err.response.data.errors &&
        err.response.data.errors.length > 0
      ) {
        errorMessage += ` - ${err.response.data.errors}`;
      }

    } else {
      errorMessage += err.message;
    }

    throw new ClientError(errorMessage, statusCode);
  });
};
/**
 * Post request.
 * @param {String} path
 * @param {Object} params
 * @param {Callback} callback
 */
JScramblerClient.prototype.post = function(path, params) {
  return this.request('POST', path, params);
};
/**
 * Patch request.
 * @param {string} path
 * @param {object} params
 */
JScramblerClient.prototype.patch = function(path, params) {
  return this.request('PATCH', path, params);
};

let _token;

Object.defineProperty(JScramblerClient.prototype, 'token', {
  get() {
    return _token;
  },
  set(value) {
    _token = value;
    if (value) {
      if (this.options.useHeaderAuth) {
        this.axiosInstance.defaults.headers['x-user-authentication'] = _token;
      }
    } else {
      delete this.axiosInstance.defaults.headers['x-user-authentication'];
    }
  }
});

exports = module.exports = JScramblerClient;
