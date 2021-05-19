# Jscrambler Metro Plugin

This metro plugin protects your **React Native** bundle using Jscrambler.

# Usage

Include the plugin in your `metro.config.js` and add the following code:

```js
const {resolve} = require('path');
const jscramblerMetroPlugin = require('jscrambler-metro-plugin')(
  /* optional */
  {
    enable: true,
    ignoreFile: resolve(__dirname, '.jscramblerignore'),
    params: [
      {
        name: 'selfDefending',
        options: {
          threshold: 1
        }
      }
    ]
  }
);

module.exports = jscramblerMetroPlugin;
```

You can pass your Jscrambler configuration using the plugin parameter or using
the usual `.jscramblerrc` file.

If you use a different location for the `.jscramblerignore` file, you can use the `ignoreFile` option to tell Jscrambler the path to the file.
Otherwise, if a `.jscramblerignore` file is found in a project root folder, it will be considered. You can find more information and examples in Ignoring Files.

By default, Jscrambler protection is **ignored** when bundle mode is set for **Development**. You can override this behavior by setting env variable `JSCRAMBLER_METRO_DEV=true` 
