# [![Jscrambler](https://media.jscrambler.com/images/logo_500px.png)](https://jscrambler.com/?utm_source=github.com&utm_medium=referral)
Jscrambler Client for Browser and Node.js

- [RC configuration](#rc-configuration)
- [CLI](#cli)
  - [Required Fields](#required-fields)
  - [Output to a single file](#output-to-a-single-file)
  - [Output multiple files to a directory](#output-multiple-files-to-a-directory)
  - [Using minimatch](#using-minimatch)
  - [Using configuration file](#using-configuration-file)
  - [Options](#options)
- [API](#api)
  - [Quick example](#quick-example)
- [Jscrambler Parameters](#jscrambler-parameters)

## Installation

On your project:

```js
npm i jscrambler --save-dev
```

Or globally:

```js
npm i -g jscrambler
```

## RC configuration
You may put your access and secret keys into a config file if found in [these directories](https://github.com/dominictarr/rc#standards). Besides simplifying the command entry, this has the added benefit of not logging your Jscrambler credentials.

Here's an example of what your `.jscramblerrc` file should look like:

```json
{
  "keys": {
    "accessKey": "_YOUR_ACCESS_KEY_",
    "secretKey": "_YOUR_SECRET_KEY_"
  },
  "applicationId": "_YOUR_APPLICATION_ID_",
  "filesSrc": [
    "/path/to/src.html",
    "/path/to/src.js"
  ],
  "filesDest": "/path/to/destDir/",
  "params": [
    {
      "name": "stringSplitting",
      "options": {
        "freq": 1
      }
    }
  ],
  "areSubscribersOrdered": false,
  "jscramblerVersion": "5.3"
}
```

Please, replace the `_YOUR_ACCESS_KEY_`, `_YOUR_SECRET_KEY_` and `_YOUR_APPLICATION_ID_` placeholders with your API credentials and Application ID. If you are having trouble finding these, please check our [Getting Started](https://docs.jscrambler.com/code-integrity/getting-started) page.

You can also download this file through Jscrambler's application builder. More
information can be found [here](https://docs.jscrambler.com/code-integrity/documentation/api/clients).

## CLI
```bash
npm install -g jscrambler
```

```
  Usage: jscrambler [options] <file ...>

  Options:

    -V, --version                    output the version number
    -a, --access-key <accessKey>     Access key
    -c, --config <config>            JScrambler configuration options
    -H, --host <host>                Hostname
    -i, --application-id <id>        Application ID
    -o, --output-dir <dir>           Output directory
    -p, --port <port>                Port
    --protocol <protocol>            Protocol (http or https)
    --cafile <path>                  Internal certificate authority
    -C, --cwd <dir>                  Current Working Directory
    -s, --secret-key <secretKey>     Secret key
    -m, --source-maps <id>           Download source maps
    -R, --randomization-seed <seed>  Set randomization seed
    --recommended-order <bool>       Use recommended order
    -W, --werror <bool>              Set werror flag value (default: true)
    --tolerate-minification <bool>   Don't detect minification as malicious tampering (default: true)
    --jscramblerVersion <version>    Use a specific Jscrambler version
    --debugMode                      Protect in debug mode
    -h, --help                       output usage information
```


### Required Fields
When making API requests you must pass valid *secret* and *access keys*, through the command line or by having a `.jscramblerrc` file. These keys are each 40 characters long, alpha numeric and uppercase strings. You can find them in your Jscrambler web dashboard under `My Profile > API Credentials`. In the examples these are shortened to `_YOUR_ACCESS_KEY_` and `_YOUR_SECRET_KEY_` for the sake of readability.

### Output to a single file
```bash
jscrambler -a _YOUR_ACCESS_KEY_ -s _YOUR_SECRET_KEY_ -i _YOUR_APPLICATION_ID_ -o output.js input.js
```

### Output multiple files to a directory
```bash
jscrambler -a _YOUR_ACCESS_KEY_ -s _YOUR_SECRET_KEY_ -i _YOUR_APPLICATION_ID_ -o output/ input1.js input2.js
```

### Using minimatch
```bash
jscrambler -a _YOUR_ACCESS_KEY_ -s _YOUR_SECRET_KEY_ -i _YOUR_APPLICATION_ID_ -o output/ "lib/**/*.js"
```

### Using configuration file
```bash
jscrambler -c config.json
```
where `config.json` is a file that optionally contains any of the Jscrambler options listed [here](#jscrambler-options), using the structure described [in the RC configuration](#rc-configuration).

## Options

### Flag -W / --werror (default: **true**)

By default, Jscrambler will not protect your application when errors occur in some or all of your files. For example: if your app have 5 files and one of them has syntax errors, Jscrambler will not protect any of your files. To override this behavior you must set the `werror` flag to `false`.

Any error/warning will make the protection fail.

There are two possible types of errors:
* Syntax errors

    Code
    ``` javascript
    function a[] {
      return
    }
    ```

    Output
    ```
    Global protection errors:
    - Errors ocurred while parsing

    Application sources errors:
    [
      {
        "filename": "index.js",
        "message": "SyntaxError: 'return' outside of function (1:0)",
        "line": 1,
        "column": null,
        "fatal": true
      }
    ]

    Protection failed. For more information visit: https://app.jscrambler.com.
    ```

* Errors parsing jscrambler [code annotations](https://docs.jscrambler.com/code-annotations/overview.html)

    Code
    ``` javascript
     //@jscrambler define __something
    function test() {
      return true;
    }

    test();

    //@jscrambler [define xxxxx]
    function test1() {
      return false;
    }

    test1();
    ```

    Output
    ```
    Global protection errors:
    - Failed to protect any source file

    Application sources errors:
    [
      {
        "filename": "index.js",
        "message": "[Annotation Error] Expected \" \" or [a-z]i but \"_\" found.",
        "line": 1,
        "column": 21,
        "fatal": true
      },
      {
        "filename": "index.js",
        "message": "[Annotation Error] Expected \" \", \"define\", \"disable\", \"enable\", \"global\", \"order\" or \"target\" but \"[\" found.",
        "line": 8,
        "column": 13,
        "fatal": true
      },
      {
        "filename": "index.js",
        "message": "Parsing errors on annotations",
        "line": null,
        "column": null,
        "fatal": true
      }
    ]

    Protection failed. For more information visit: https://app.jscrambler.com.
    ```

### Using a proxy to make requests ###
If your requests need to go through a proxy, there is an option where you can specify the ip address, port and authentication credentials.
```
{
  proxy: {
    host: '',
    port: 1234,
    auth: {
      username: '',
      password: ''
    }
  }
}

```

WARNING: currently we only support HTTP proxies. In order to make it use your proxy, you just need to add the proxy details to the Jscrambler config file as above and use the port 80 of our service (this is the HTTP port of the Jscrambler API).

```
{
  port: 80,
  proxy: {
      host: '',
      port: 1234,
      auth: {
        username: '',
        password: ''
      }
  }
}
```

### Recommended Order (default: **false**)
```bash
jscrambler --recommended-order false input1.js -o output/
```

To enable:
```bash
jscrambler --recommended-order true input1.js -o output/
```

## API
```bash
npm install jscrambler
```

### Quick example
```javascript
var jscrambler = require('jscrambler').default;

jscrambler.protectAndDownload({
  keys: {
    accessKey: '_YOUR_ACCESS_KEY_',
    secretKey: '_YOUR_SECRET_KEY_'
  },
  host: 'api4.jscrambler.com',
  port: 443,
  applicationId: '_YOUR_APPLICATION_ID_',
  filesSrc: [
    '/path/to/src/*.html',
    '/path/to/src/*.js'
  ],
  filesDest: '/path/to/destDir/',
  params: [
    {
      'name': 'whitespaceRemoval'
    },
    {
      'name': 'duplicateLiteralsRemoval'
    }
  ]
})
.then(function () {
  console.log('All done!');
})
.catch(function (err) {
  console.error(err);
});
```

More detailed informations can be found [here](https://docs.jscrambler.com/code-integrity/documentation/api/clients).

## Jscrambler Parameters

Please refer to [docs](https://docs.jscrambler.com/) for more information.
