# ![Jscrambler](https://media.jscrambler.com/images/logo_500px.png)
# Jscrambler Code Integrity for Webpack

Jscrambler [Code Integrity](https://jscrambler.com/code-integrity) is a JavaScript protection technology for Web and Mobile Applications. Its main purpose is to enable JavaScript applications to become self-defensive and resilient to tampering and reverse engineering.

If you're looking to gain control over third-party tags and achieve PCI DSS compliance please refer to Jscrambler [Webpage Integrity](https://jscrambler.com/webpage-integrity).

Version Compatibility
------------------------------------------------------------------------------

The version's compatibility table match your [Jscrambler Version](https://app.jscrambler.com/settings) with the Jscrambler Webpack Plugin.
Please make sure you install the right version, otherwise some functionalities might not work properly.

| _Jscrambler Version_   |      _Client and Integrations_      |
|:----------:|:-------------:|
| _<= 7.1_ |  _<= 5.x.x_ |
| _\>= 7.2_ |   _\>= 6.0.0_ |

# Usage

This plugin protects your **webpack output** using Jscrambler.

Simply add the plugin to your configuration. We recommend placing it after every other plugin that also modifies your code. It will automatically gather all JavaScript and HTML files and protect them.

Example `webpack.config.js`:

```js
const {resolve} = require('path');
const JscramblerWebpack = require('jscrambler-webpack-plugin');

module.exports = {
  mode: 'production',
  entry: {
    protected: './app/index.js',
    unprotected: './app/index.js'
  },
  output: {
    filename: 'dist/[name].js'
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        loader: 'babel-loader'
      }
    ]
  },
  plugins: [
    new JscramblerWebpack({
      enable: true, // OPTIONAL, defaults to true
      chunks: ['protected'], // OPTIONAL, defaults to all chunks
      ignoreFile: resolve(__dirname, '.jscramblerignore'), // OPTIONAL, defaults to no ignore file
      params: [], 
      obfuscationLevel: 'bundle', // OPTIONAL. Available options are: bundle (default) or module
      obfuscationHook: 'processAssets' // OPTIONAL. Available options are: processAssets (default) and emit (Webpack v4 and below)   
      // and other jscrambler configurations
    })
  ]
};
```

The Jscrambler client will use .jscramblerrc as usual, though it is possible to override specific values using the plugin's configuration.

The *ignoreFile* option will tell Jscrambler the path to the `.jscramblerignore` file. You can find more informations and examples in [Ignoring Files](https://docs.jscrambler.com/code-integrity/documentation/ignoring-files).

Additionally, you may specify which chunks to protect using the `chunks` property, which accepts an array with the names of the chunks you wish to protect.

## Obfuscation level

You can obfuscation **the entire bundle (default way)** or **the modules** inside it. The latter option is required when the native APIs (or polyfills) are not available right at the beginning of the application runtime.

**Early versions of NativeScript** mobile framework (<= 6) are a good example of this behaviour, and in order to protect those NativeScript Applications with Jscrambler you must set **obfuscationLevel** to **module**.

**Note:** Ofuscation level module is not compatible with source maps.

## Subresources Integrity (SRI)

There are some webpack plugins, such as [webpack-subresources-integrity](https://www.npmjs.com/package/webpack-subresource-integrity), that should run after the obfuscation step. 

Please, make sure the [webpack-subresources-integrity](https://www.npmjs.com/package/webpack-subresource-integrity) plugin is added after the `JscramblerWebpackPlugin`. For example:

```javascript
  plugins: [
    ...,
    new JscramblerPlugin({
        obfuscationHook: "processAssets"
    }),
    new SubresourceIntegrityPlugin({
        hashFuncNames: ["sha384"],
        enabled: true,
    }),
]
```
