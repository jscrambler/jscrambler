ember-cli-jscrambler
==============================================================================

Version Compatibility
------------------------------------------------------------------------------

The version's compatibility table match your [Jscrambler Version](https://app.jscrambler.com/settings) with the Jscrambler Ember Client.
Please make sure you install the right version, otherwise the some functionalities might not work properly.

| _Jscrambler Version_   |      _Client and Integrations_      |
|:----------:|:-------------:|
| _<= 7.1_ |  _<= 5.0.0_ |
| _\>= 7.2_ |   _\>= 6.0.0_ |

Installation
------------------------------------------------------------------------------

```
ember install ember-cli-jscrambler
```

Usage
------------------------------------------------------------------------------

After installing `ember-cli-jscrambler` it will automatically hook into the build
pipeline. In order to protect your code you need to add a .jscramblerrc file to the root of your directory your JS files will them be protected in production builds.

If you want to customize how `ember-cli-jscrambler` is running [Jscrambler](https://jscrambler.com) under the
hood you can exclude specific files by specifying them as it follows
```js
// ember-cli-build.js

var app = new EmberApp({
  'ember-cli-jscrambler': {
    exclude: ['assets/vendor.js'],
  }
});
```


### Options
- `exclude?: string[]`: A list of paths or globs to exclude from minification
