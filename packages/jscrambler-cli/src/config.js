import rc from 'rc';
import {CLIENT_IDS} from './constants';
import { version } from '../package.json';

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
    clientVersion: version,
    utc: true,
    maxRetries: 5,
    saveSrc: true,
  },
  []
);

export default config;
