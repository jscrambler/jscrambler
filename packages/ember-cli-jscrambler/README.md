# ![Jscrambler](https://media.jscrambler.com/images/logo_500px.png)
Jscrambler Code Integrity for Ember-CLI
==============================================================================
Jscrambler [Code Integrity](https://jscrambler.com/code-integrity) is a JavaScript protection technology for Web and Mobile Applications. Its main purpose is to enable JavaScript applications to become self-defensive and resilient to tampering and reverse engineering.

If you're looking to gain control over third-party tags and achieve PCI DSS compliance please refer to Jscrambler [Webpage Integrity](https://jscrambler.com/webpage-integrity).

Version Compatibility
------------------------------------------------------------------------------

The version's compatibility table match your [Jscrambler Version](https://app.jscrambler.com/settings) with the Jscrambler Ember Client.
Please make sure you install the right version, otherwise some functionalities might not work properly.

| _Jscrambler Version_   |      _Client and Integrations_      |
|:----------:|:-------------:|
| _<= 7.1_ |  _<= 5.x.x_ |
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
