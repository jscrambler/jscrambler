# ![Jscrambler](https://media.jscrambler.com/images/logo_500px.png)
Jscrambler Code Integrity for Gulp
--------------------

Jscrambler [Code Integrity](https://jscrambler.com/code-integrity) is a JavaScript protection technology for Web and Mobile Applications. Its main purpose is to enable JavaScript applications to become self-defensive and resilient to tampering and reverse engineering.

If you're looking to gain control over third-party tags and achieve PCI DSS compliance please refer to Jscrambler [Webpage Integrity](https://jscrambler.com/webpage-integrity).

## How to Use

Add obfuscation to your build process with [gulp](https://github.com/wearefractal/gulp) and gulp-jscrambler.

### Version Compatibility
------------------------------------------------------------------------------

The version's compatibility table match your [Jscrambler Version](https://app.jscrambler.com/settings) with the Jscrambler Gulp Client.
Please make sure you install the right version, otherwise some functionalities might not work properly.

| _Jscrambler Version_   |      _Client and Integrations_      |
|:----------:|:-------------:|
| _<= 7.1_ |  _<= 5.x.x_ |
| _\>= 7.2_ |   _\>= 6.0.0_ |

### Install

Install with [npm](https://npmjs.org/package/gulp-jscrambler).

```
npm install -D gulp-jscrambler
```
Option `-D` will make sure it is installed as a `devDependency`.

### Setup your Jscrambler Gulp task

In order to start using gulp-jscrambler you will need to add a new task to your project `gulpfile.js`. This task will be responsible for protecting your application with Jscrambler.

Here's an example of how Jscrambler task should look like:

```js
const gulp = require('gulp');
const jscrambler = require('gulp-jscrambler');

function enable(filesSrc) {
  if (filesSrc.length === 0) {
    return false;
  }

  return true;
}

gulp.task('default', function (done) {
  gulp
    .src('app/**/*.js')
    .pipe(jscrambler({
      keys: {
        accessKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
        secretKey: 'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX'
      },
      applicationId: 'XXXXXXXXXXXX',
      enable,
      params: [
        {
          name: 'whitespaceRemoval'
        },
        {
          name: 'stringSplitting'
        }
      ]
    }))
    .pipe(gulp.dest('dist/'))
    .on('end', done);
});
```

You will need your credentials and Application ID in order to protect your application.
Navigate to your [Settings](https://app.jscrambler.com/settings) page and grab your `accessKey` and `secretKey` at the _API Credentials_ section.

Your `applicationId` can be found inside your application page just below your application name. Click the copy to clipboard icon to copy the `applicationId`.

![Application ID](https://blog.jscrambler.com/content/images/2018/08/jscrambler-101-first-use-app-id.jpg)

You can also grab your current configuration on your application page. This will download a `.json` file containing a valid configuration with your currently selected options.

![download config file location](https://blog.jscrambler.com/content/images/2018/08/jscrambler-101-first-use-download-json.png)

Keep in mind that the `params` object is optional and if it is not provided we will use your previous configuration.

The `enable` object is an optional function (returns true by default) that will allow to manipulate the files sources and decide if you want to protect them (returning true) or skip (returning false). The example provided before is a use case that will skip the Jscrambler protection when there isn't any files on source.

### Usage Example

You can find some working examples [here](https://github.com/jscrambler/jscrambler/tree/master/packages/gulp-jscrambler/examples).
