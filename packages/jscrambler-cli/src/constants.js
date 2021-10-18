export const HTTP_STATUS_CODES = Object.freeze({
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504
});

export const JSCRAMBLER_ERROR_CODES = Object.freeze({
  INVALID_SIGNATURE: '254'
});

export const CLIENT_IDS = Object.freeze({
  CLI: 0,
  APP: 1,
  WEBPACK: 2,
  GULP: 3,
  GRUNT: 4,
  EMBER: 5,
  METRO: 6
});

export const CLIENT_PACKAGES = Object.freeze({
  [CLIENT_IDS.CLI]: 'jscrambler',
  [CLIENT_IDS.APP]: 'app',
  [CLIENT_IDS.WEBPACK]: 'jscrambler-webpack-plugin',
  [CLIENT_IDS.GULP]: 'gulp-jscrambler',
  [CLIENT_IDS.GRUNT]: 'grunt-jscrambler',
  [CLIENT_IDS.EMBER]: 'ember-cli-jscrambler',
  [CLIENT_IDS.METRO]: 'jscrambler-metro-plugin'
});
