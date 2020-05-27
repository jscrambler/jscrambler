import defaults from 'lodash.defaults';
import fs from 'fs';
import keys from 'lodash.keys';
import axios from 'axios';
import url from 'url';
import https from 'https';

import cfg from './config';
import generateSignedParams from './generate-signed-params';

const debug = !!process.env.DEBUG;

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
 * @author José Magalhães (magalhas@gmail.com)
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
    maxContentLength: 100 * 1000 * 1000 // 100 MB
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
      params
    );
  } else {
    signedData = params;
  }

  let {protocol, port, proxy} = this.options;

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

  const formatedUrl =
    url.format({
      hostname: this.options.host,
      port,
      pathname: this.options.basePath + path,
      protocol
    });

  let data;
  const settings = {};

  if (proxy) {
    settings.proxy = proxy;
  }

  if (!isJSON) {
    settings.responseType = 'arraybuffer';
  }

  // Internal CA
  if (this.options.cafile) {
    const agent = new https.Agent({
      ca: fs.readFileSync(this.options.cafile)
    });
    settings.httpsAgent = agent;
  }



  let promise;

  if (method === 'GET' || method === 'DELETE') {
    settings.params = signedData;
    promise = this.axiosInstance[method.toLowerCase()](formatedUrl, settings);
  } else {
    data = signedData;
    promise = this.axiosInstance[method.toLowerCase()](formatedUrl, data, settings);
  }

  return promise.then(res => {
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

      // For when we have API error messages
      if (
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
