# ![jscrambler](https://rawgithub.com/jscrambler/javascript-jscrambler/master/media/jscrambler-logo.png)
Jscrambler Client for Browser and Node.js

> DISCLAIMER: If you are looking for Jscrambler 3.8 or below please go to [this page](https://github.com/jscrambler/node-jscrambler).

- [RC configuration](#rc-configuration)
- [CLI](#cli)
  - [Required Fields](#required-fields)
  - [Output to a single file](#output-to-a-single-file)
  - [Output multiple files to a directory](#output-multiple-files-to-a-directory)
  - [Using minimatch](#using-minimatch)
  - [Using configuration file](#using-configuration-file)
- [API](#api)
  - [Quick example](#quick-example)
- [JScrambler Parameters](#jscrambler-parameters)

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
    "accessKey": "AAAA",
    "secretKey": "SSSS"
  },
  "applicationId": "XXXXX",
  "filesSrc": [
    "/path/to/src.html",
    "/path/to/src.js"
  ],
  "filesDest": "/path/to/destDir/",
  "params": [
    {
      "name": "stringSplitting"
    }
  ],
  "areSubscribersOrdered": false,
  "jscramblerVersion": "5.1"
}
```

Please, replace the `AAAA`, `SSSS` and `XXXXX` placeholders with your API credentials and Application ID.

You can also download this file through Jscrambler's application builder. More
information can be found [here](https://docs.jscrambler.com/api/clients.html).

## CLI
```bash
npm install -g jscrambler
```
```
  Usage: jscrambler [options] <file ...>

  Options:

    -h, --help                       output usage information
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
    -m, --source-maps <id>           Download source maps
    -R, --randomization-seed <seed>  Set randomization seed
    -s, --secret-key <secretKey>     Secret key
    -R, --randomization-seed <seed>  Set randomization seed
    --recommended-order <bool>       Use recommended order
    -W --werror                      Cancel protection if any file contains errors
    --jscramblerVersion <version>    Use a specific Jscrambler version
```


### Required Fields
When making API requests you must pass valid secret and access keys, through the command line or by having a `.jscramblerrc` file. These keys are each 40 characters long, alpha numeric strings, and uppercase. You can find them in your jscramber web dashboard under `My Profile > API Credentials`. In the examples these are shortened to `AAAA` and `SSSS` for the sake of readability.

### Flag -W / --werror

Jscrambler by default will protect your application even if errors occurred in some of your files. For example: if your app have 5 files and 1 of them has syntax errors, Jscrambler will protect the files with no errors and keep the original content in the other one.

With this flag, any error/warning will make the protection fail. 
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
    Error: "Unexpected token [" in test.js:1
    Protection failed
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
    Error: "[Annotation Error] Expected " " or [a-z]i but "_" found." in test.js:1
    Error: "[Annotation Error] Expected " ", "define", "disable", "enable", "global", "order" or "target" but "[" found." in test.js:8
    Error: "Parsing errors on annotations" in test.js
    Protection failed
    ```

### Output to a single file
```bash
jscrambler -a AAAA -s SSSS -i APP_ID -o output.js input.js
```

### Output multiple files to a directory
```bash
jscrambler -a AAAA -s SSSS -i APP_ID -o output/ input1.js input2.js
```

### Using minimatch
```bash
jscrambler -a AAAA -s SSSS -i APP_ID -o output/ "lib/**/*.js"
```

### Using configuration file
```bash
jscrambler -c config.json
```
where `config.json` is an object optionally containing any of the JScrambler options listed [here](#jscrambler-options), using the structure described [in the RC configuration](#rc-config).


### Enabling/disabling the recommended order
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
    accessKey: 'YOUR_JSCRAMBLER_ACCESS_KEY',
    secretKey: 'YOUR_JSCRAMBLER_SECRET_KEY'
  },
  host: 'api4.jscrambler.com',
  port: 443,
  applicationId: 'YOUR_APPLICATION_ID',
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

## JScrambler Parameters

Please refer to [docs](https://docs.jscrambler.com/) for more information.
