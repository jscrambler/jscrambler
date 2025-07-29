import rc from 'rc';
import {CLIENT_IDS} from './constants';

// Load RC configuration if present. Pass `[]` as last argument to avoid
// getting variables from `argv`.
const config = rc(
  'jscrambler',
  {
    keys: {},
    host: 'api4.jscrambler.com',
    basePath: '',
    jscramblerVersion: 'stable',
    werror: true,
    clientId: CLIENT_IDS.CLI,
    utc: true,
    maxRetries: 5,
    saveSrc: true,
    generateAlias: true,
  },
  []
);

export default config;
