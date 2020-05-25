# [![Jscrambler](https://media.jscrambler.com/images/logo_500px.png)](https://jscrambler.com/?utm_source=github.com&utm_medium=referral)
Jscrambler Client for Browser and Node.js

- [Jscrambler](https://jscrambler.com/?utm_source=github.com&utm_medium=referral)
  - [Installation](#installation)
  - [RC configuration](#rc-configuration)
  - [CLI](#cli)
    - [Required Fields](#required-fields)
    - [Output to a single file](#output-to-a-single-file)
    - [Output multiple files to a directory](#output-multiple-files-to-a-directory)
    - [Using minimatch](#using-minimatch)
    - [Using configuration file](#using-configuration-file)
  - [Options](#options)
    - [Current working directory (--cwd)](#current-working-directory---cwd)
    - [Flag -W / --werror (default: **true**)](#flag--w----werror-default-true)
    - [Using a proxy to make requests](#using-a-proxy-to-make-requests)
    - [Recommended Order (default: **false**)](#recommended-order-default-false)
    - [Profiling Data Mode (default: **automatic**)](#profiling-data-mode-default-automatic)
    - [Instrument (`--instrument`)](#instrument---instrument)
  - [Symbol Table](#symbol-table)
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
  -V, --version                           output the version number
  -a, --access-key <accessKey>            Access key
  -c, --config <config>                   Jscrambler configuration options
  -H, --host <host>                       Hostname
  -i, --application-id <id>               Application ID
  -o, --output-dir <dir>                  Output directory
  -p, --port <port>                       Port
  --protocol <protocol>                   Protocol (http or https)
  --cafile <path>                         Internal certificate authority
  -C, --cwd <dir>                         Current Working Directory
  -s, --secret-key <secretKey>            Secret key
  -m, --source-maps <id>                  Download source maps
  -R, --randomization-seed <seed>         Set randomization seed
  --instrument                            Instrument file(s) before start profiling. ATTENTION: previous profiling information will be deleted
  --start-profiling                       Starts profiling (assumes an already instrumented application)
  --stop-profiling                        Stops profiling
  --code-hardening-threshold <threshold>  Set code hardening file size threshold. Format: {value}{unit="b,kb,mb"}. Example: 200kb
  --recommended-order <bool>              Use recommended order
  -W, --werror <bool>                     Set werror flag value (default: true)
  --tolerate-minification <bool>          Don't detect minification as malicious tampering (default: true)
  --use-profiling-data <bool>             (version 6.2 only) Protection should use the existing profiling data (default: true)
  --profiling-data-mode <mode>            (version 6.3 and above) Select profiling mode (default: automatic)
  --remove-profiling-data                 Removes the current application profiling information
  --use-app-classification <bool>         (version 6.3 and above) Protection should use Application Classification metadata when protecting (default: true)
  --input-symbol-table <file>             (version 6.3 and above) Protection should use symbol table when protecting. (default: no file)
  --output-symbol-table <id>              (version 6.3 and above) Download symbol table (json)
  --jscramblerVersion <version>           Use a specific Jscrambler version
  --debugMode                             Protect in debug mode
  --skip-sources                          Prevent source files from being updated
  -h, --help                              output usage information
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

### Current working directory (--cwd)

JavaScript projects usually have a folder structure that must be preserved in order for the application to work properly.
In order to make sure that that structure is preserved, the `jscrambler` client needs to know what is the path of the root folder of your project's file structure.
We call this path the Current Working Directory (CWD). The folder structure of all the subdirectories of the paths that match the patterns passed to the `jscrambler`
cli will be replicated in the output folder (specified by the `filesDest` parameter.)

There are three ways to define this setting:
  - If you use relative paths as input patterns, then the CWD is assumed to be the path on which the CLI was executed.
    For example, the following command, executed in `/home/user` (assuming `config.js` does not define neither `filesSrc` nor `filesDest`):
    ```bash
    jscrambler --config config.js -o out/ project/dist/*.js
    ```
    will output the protected files as `/home/user/out/project/dist/<filename>.js`.

  - If you use absolute paths as input patterns, then the CWD is assumed to be the root of the filesystem (`/`).
    For example, changing the previous command to use an absolute path:
    ```bash
    jscrambler --config config.js -o out/ /home/user/project/dist/*.js
    ```
    results in the files being output to `/home/user/out/home/user/project/dist/<filename>.js`

  - To change this behaviour, you can use the `--cwd` option to explicitly set the CWD:
    ```bash
    jscrambler --config config.js --cwd /home/user -o out/ /home/user/project/dist/*.js
    ```
    which results in the files being output to `/home/user/out/project/dist/<filename>.js`

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

### Recommended Order (default: **false**)
```bash
jscrambler --recommended-order false input1.js -o output/
```

To enable:
```bash
jscrambler --recommended-order true input1.js -o output/
```

### Profiling Data Mode (default: **automatic**)

**Note**: This option was introduced in the version 6.3 and should be used instead of **use-profiling-data** which is deprecated.

The **profiling-data-mode** option can be set to three different modes:
* **Annotations**: considers only the profiling annotations;
* **Automatic (default)**: ignores the existing profiling annotations and only considers the application's profiling data;
* **Off**: uses neither profiling data nor profiling annotations.

The following behaviour:

```
jscrambler --profiling-data-mode off ...
```

Has the same effect as:

```
jscrambler --use-profiling-data false ...
```
### Instrument (`--instrument`)

Instrument is used when you want to [Profile](https://docs.jscrambler.com/code-integrity/documentation/profiling) your application. It is a similar process as protecting your application, but it will just instrument your application so that we can collect some data about how it runs. When you instrument an application, `jscrambler` will output the instrumented version of that application to the specified file/directory. Check our [documentation](https://docs.jscrambler.com/code-integrity/documentation/profiling) for more detailed information.

**NOTE**: When you run this command, the existing profiling information will be **deleted** (if any).

**WARNING:** DO NOT SEND THIS CODE TO PRODUCTION AS IT IS NOT PROTECTED

## Symbol Table

Jscrambler can import symbol tables to ensure certain global variables and object properties have specific names.
These symbol tables can be passed using the `--input-symbol-table <file>` option, or with the `inputSymbolTable`
option in the configuration file.

These files follow the schema used by `uglifyjs@^3`:

```json
{
  "vars": {
    "props": {
      "$globalName": "transformedName"
    }
  },
  "props": {
    "props": {
      "$propertyName": "transformedName"
    }
  }
}
```

Similarly, the resulting symbol table can be obtained using the `--output-symbol-table <protectionId>` option.

**NOTE**: It only makes sense to use symbol tables on protections that use the identifiers renaming parameter.

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
