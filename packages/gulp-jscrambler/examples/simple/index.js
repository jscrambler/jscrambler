var isOldIEBrowser = require('./module');

if (isOldIEBrowser()) {
  console.warn('old IE version detected');
} else {
  console.log('valid browser');
}
