# ![Jscrambler](https://media.jscrambler.com/images/logo_500px.png)
[grunt](https://github.com/gruntjs/grunt)-jscrambler
--------------------

Add obfuscation to your build process with [grunt](https://github.com/gruntjs/grunt) and grunt-jscrambler.

## How to Use
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
      ]
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
      ]
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
