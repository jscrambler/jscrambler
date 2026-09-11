# ![Jscrambler](https://media.jscrambler.com/images/logo_500px.png)
# Jscrambler Code Integrity for React-Native and Vega Os

Jscrambler [Code Integrity](https://jscrambler.com/code-integrity) is a JavaScript protection technology for Web and Mobile Applications. Its main purpose is to enable JavaScript applications to become self-defensive and resilient to tampering and reverse engineering.

If you're looking to gain control over third-party tags and achieve PCI DSS compliance please refer to Jscrambler [Webpage Integrity](https://jscrambler.com/webpage-integrity).

Version Compatibility
------------------------------------------------------------------------------

The version's compatibility table match your [Jscrambler Version](https://app.jscrambler.com/settings) with the Jscrambler Metro Plugin.
Please make sure you install the right version, otherwise some functionalities might not work properly.

| _Jscrambler Version_ | _Client and Integrations_ |
|:--------------------:|:-------------------------:|
|       _<= 7.1_       |        _<= 5.x.x_         |
|      _\>= 7.2_       |    _\>= 6.0.0 <=8.5.0_    |
|      _\>= 8.6_       |        _\>= 9.0.0_        |

# Usage

This metro plugin protects your [React Native](https://reactnative.dev/) and [Vega](https://developer.amazon.com/apps-and-games/vega) bundle using Jscrambler.

First install the **jscrambler-metro-plugin** as a development dependency

```shell
npm install -D jscrambler-metro.plugin
```

Then, set up the plugin in your `metro.config.js` by adding the following code:

```js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const jscramblerMetroPlugin = require('jscrambler-metro-plugin')();

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  ...jscramblerMetroPlugin
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

Finally, create a `.jscramblerrc` file with your Jscrambler configuration downloaded from Code Integrity Application Dashboard.

By default, Jscrambler protection is **ignored** when bundle mode is set for **Development**. You can override this behavior by setting env variable `JSCRAMBLER_METRO_DEV=true`

In order to activate source map generation effectively, you will need to enable source maps both in the Jscrambler configuration file, by adding the following parameter to said file:

```json
{
  ...
 "sourceMaps": true,
  ...
}
```

and in the [React Native app](https://reactnative.dev/docs/debugging-release-builds?platform=android#enabling-source-maps).

## Plugin Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `enable` | `boolean` | `true` | Enables Jscrambler protection. Set to `false` to skip protection. |
| `enabledHermes` | `boolean` | `true` | Enables Hermes-specific compatibility handling. Set to `false` when the app does not use Hermes. |
| `ignoreFile` | `string` | `.jscramblerignore` in the project root | Path to the ignore file used to exclude files from protection. |
| `params` | `Array<object>` | Value from `.jscramblerrc` | Overrides the `params` transformation list from `.jscramblerrc`, useful for testing. |

```js
const jscramblerMetroPlugin = require('jscrambler-metro-plugin')(
    /* OPTIONAL */
    {
        enable: true, 
        enabledHermes: true,
        ignoreFile: resolve(__dirname, '.jscramblerignore'),
        // overrides the params on `.jscramblerrc` file. Usefull for testing purposes.
        params: [  
            {
              name: "stringConcealing",
              options: {
                freq: 1,
                max: -1
              }
            }
        ]
    }
);
```
