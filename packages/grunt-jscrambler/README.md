# ![Jscrambler](https://media.jscrambler.com/images/logo_500px.png)
Jscrambler Code Integrity from Grunt
--------------------

Jscrambler [Code Integrity](https://jscrambler.com/code-integrity) is a JavaScript protection technology for Web and Mobile Applications. Its main purpose is to enable JavaScript applications to become self-defensive and resilient to tampering and reverse engineering.

If you're looking to gain control over third-party tags and achieve PCI DSS compliance please refer to Jscrambler [Webpage Integrity](https://jscrambler.com/webpage-integrity).

Version Compatibility
------------------------------------------------------------------------------

The version's compatibility table match your [Jscrambler Version](https://app.jscrambler.com/settings) with the Jscrambler Grunt Client.
Please make sure you install the right version, otherwise some functionalities might not work properly.

| _Jscrambler Version_   |      _Client and Integrations_      |
|:----------:|:-------------:|
| _<= 7.1_ |  _<= 5.x.x_ |
| _\>= 7.2_ |   _\>= 6.0.0_ |

## How to Use

Add obfuscation to your build process with [grunt](https://github.com/gruntjs/grunt) and grunt-jscrambler.

If you haven't used [Grunt](http://gruntjs.com/) before, be sure to check out the [Getting Started](http://gruntjs.com/getting-started) guide, as it explains how to create a [Gruntfile](http://gruntjs.com/sample-gruntfile) as well as install and use Grunt plugins.

### Install
Once you're familiar with that process, you may install this plugin:

```shell
npm install grunt-jscrambler --save-dev
```

Once the plugin has been installed, it may be enabled inside your Gruntfile with this line of JavaScript:

```js
grunt.loadNpmTasks('grunt-jscrambler');
```

### Setup your Jscrambler Grunt task

In your project's Gruntfile, add a section named `jscrambler` to the data object passed into `grunt.initConfig()`.
#### Relative path
```js
grunt.initConfig({
  jscrambler: {
    main: {
      options: {
        keys: {
          accessKey: '',
          secretKey: ''
        },
        applicationId: '',
        params: [
          {
            name: 'whitespaceRemoval'
          },
          {
            name: 'charToTernaryOperator'
          }
        ]
      },
      files: [
        {expand: true, src: ['foo.js', 'bar.js'], dest: 'dist/'},
      ],
      // (Optional) Retrieve the protection Id
      successCallback(protectionId) {
        // console.log('Protection Id: ', protectionId);
      }
    }
  },
});
```
#### Absolute path
```js
grunt.initConfig({
  jscrambler: {
    main: {
      options: {
        keys: {
          accessKey: '',
          secretKey: ''
        },
        applicationId: '',
        params: [
          {
            name: 'whitespaceRemoval'
          },
          {
            name: 'charToTernaryOperator'
          }
        ]
      },
      files: [
        {
          expand: true,
          cwd: '/example/src/'
          src: ['foo.js', 'bar.js'],
          dest: '/destination/'
        },
        {
          expand: true,
          cwd: '/otherexample/'
          src: ['foo.js', 'bar.js'],
          dest: '/otherdestination/'
        }
      ],
      // (Optional) Retrieve the protection Id
      successCallback(protectionId) {
        // console.log('Protection Id: ', protectionId);
      }
    }
  },
});
```
You will need your credentials and Application ID in order to protect your application.
Navigate to your [Settings](https://app.jscrambler.com/settings) page and grab your `accessKey` and `secretKey` at the _API Credentials_ section.

Your `applicationId` can be found inside your application page just below your application name. Click the copy to clipboard icon to copy the `applicationId`.

![Application ID](https://blog.jscrambler.com/content/images/2018/08/jscrambler-101-first-use-app-id.jpg)

You can also grab your current configuration on your application page. This will download a `.json` file containing a valid configuration with your currently selected options.

![download config file location](https://blog.jscrambler.com/content/images/2018/08/jscrambler-101-first-use-download-json.png)

Keep in mind that the `params` object is optional and if it is not provided we will use your previous configuration.

### Usage Example

You can find some working examples [here](https://github.com/jscrambler/jscrambler/tree/master/packages/grunt-jscrambler/examples).
