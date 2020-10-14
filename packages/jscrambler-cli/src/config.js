import rc from 'rc';

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
    clientId: 0,
    utc: true,
    maxRetries: 5
  },
  []
);

export default config;
