# Jscrambler Metro Plugin

This plugin protects your metro output using Jscrambler.

# Usage

Include the plugin in your `metro.config.js` and add the following code:

```js
const jscramblerMetro = require('jscrambler-metro-plugin');

jscramblerMetro.install();

module.exports = {
  transformer: {
    // Only necessary to use Jscrambler annotations. If your code does not use
    // annotations, the install() function call above is sufficient.
    minifierPath: jscramblerMetro.getDummyMinifierPath()
  }
};
```

The Jscrambler client will use .jscramblerrc as usual.

