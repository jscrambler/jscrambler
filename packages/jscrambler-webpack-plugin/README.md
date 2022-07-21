# Jscrambler Webpack Plugin

This plugin protects your webpack output using Jscrambler.

# Version Compatibility
------------------------------------------------------------------------------

The version's compatibility table match your [Jscrambler Version](https://app.jscrambler.com/settings) with the Jscrambler Webpack Plugin.
Please make sure you install the right version, otherwise some functionalities might not work properly.

| _Jscrambler Version_   |      _Client and Integrations_      |
|:----------:|:-------------:|
| _<= 7.1_ |  _<= 5.x.x_ |
| _\>= 7.2_ |   _\>= 6.0.0_ |

# Usage

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
      enable: true, // optional, defaults to true
      chunks: ['protected'], // optional, defaults to all chunks
      ignoreFile: resolve(__dirname, '.jscramblerignore'), // optional, defaults to no ignore file
      params: [], 
      obfuscationLevel: 'bundle' // optional. Available options are: bundle (default) or module
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
