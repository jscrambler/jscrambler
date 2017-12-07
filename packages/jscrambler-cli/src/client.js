import clone from 'lodash.clone';
import crypto from 'crypto';
import defaults from 'lodash.defaults';
import fs from 'fs';
import keys from 'lodash.keys';
import request from 'axios';
import url from 'url';
import https from 'https';

import cfg from './config';
import generateSignedParams from './generate-signed-params';

/**
 * @class JScramblerClient
 * @param {Object} options
 * @param {String} options.accessKey
 * @param {String} options.secretKey
 * @param {String} [options.host=api.jscrambler.com]
 * @param {String} [options.port=443]
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

  if (this.options.jscramblerVersion) {
    request.defaults.headers.common.jscramblerVersion = this.options.jscramblerVersion;
  }
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

  // Format URL
  const protocol =
    this.options.protocol || (this.options.port === 443 ? 'https' : 'http');

  const formatedUrl =
    url.format({
      hostname: this.options.host,
      port: this.options.port,
      protocol
    }) + path;

  let data;
  const settings = {};

  if (!isJSON) {
    settings.responseType = 'arraybuffer';
  }

  // Internal CA
  if (this.options.cafile) {
    const agent = new https.Agent({
      ca: fs.readFileSync(this.options.cafile)
    });
    settings.agent = agent;
  }

  let promise;

  if (method === 'GET' || method === 'DELETE') {
    settings.params = signedData;
    promise = request[method.toLowerCase()](formatedUrl, settings);
  } else {
    data = signedData;
    promise = request[method.toLowerCase()](formatedUrl, data, settings);
  }

  return promise.then(res => {
    if (res.status >= 200 && res.status < 400) {
      return res.data;
    }

    throw new Error(`Unexpected Response Code: ${res.status}`);
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

exports = module.exports = JScramblerClient;
