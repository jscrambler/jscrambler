# ![Jscrambler](https://media.jscrambler.com/images/logo_500px.png)
# Jscrambler Code Integrity for React-Native (Metro Bundler)

Jscrambler [Code Integrity](https://jscrambler.com/code-integrity) is a JavaScript protection technology for Web and Mobile Applications. Its main purpose is to enable JavaScript applications to become self-defensive and resilient to tampering and reverse engineering.

If you're looking to gain control over third-party tags and achieve PCI DSS compliance please refer to Jscrambler [Webpage Integrity](https://jscrambler.com/webpage-integrity).

Version Compatibility
------------------------------------------------------------------------------

The version's compatibility table match your [Jscrambler Version](https://app.jscrambler.com/settings) with the Jscrambler Metro Plugin.
Please make sure you install the right version, otherwise some functionalities might not work properly.

| _Jscrambler Version_   |      _Client and Integrations_      |
|:----------:|:-------------:|
| _<= 7.1_ |  _<= 5.x.x_ |
| _\>= 7.2_ |   _\>= 6.0.0_ |

# Usage

This metro plugin protects your **React Native** bundle using Jscrambler.

Include the plugin in your `metro.config.js` and add the following code:

```js
const {resolve} = require('path');
const jscramblerMetroPlugin = require('jscrambler-metro-plugin')(
  /* optional */
  {
    enable: true,
    enabledHermes: false, // set if you are using hermes engine
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
