# Jscrambler Webpack Plugin

This plugin protects your webpack output using Jscrambler.

# Usage

Simply add the plugin to your configuration. We recommend placing it after every other plugin that also modifies your code. It will automatically gather all JavaScript and HTML files and protect them.

Example `webpack.config.js`:

```js
const JscramblerWebpack = require('jscrambler-webpack-plugin');

module.exports = {
  entry: {
    protected: './app/index.js',
    unprotected: './app/index.js'
  },
  output: {
    filename: 'dist/[name].js'
  },
  devtool: 'source-map',
  module: {
    loaders: [
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
      params: [], 
      applicationTypes: {}
      // and other jscrambler configurations
    })
  ]
};
```

The Jscrambler client will use .jscramblerrc as usual, though it is possible to override specific values using the plugin's configuration.

Additionally, you may specify which chunks to protect using the `chunks` property, which accepts an array with the names of the chunks you wish to protect.
