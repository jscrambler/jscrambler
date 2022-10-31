# Jscrambler Github Action

This action lets you protect your source code with Jscrambler.

## Inputs

The following inputs are supported:

  * `access-key` and `secret-key`: User keys for authentication (we recommend using github secrets for this)
  * `application-id`: User application ID
  * `jscrambler-config-path`: Path to JSON with Jscrambler configuration, including protection parameters
  * `files-src`: Paths of source files to protect. Glob patterns allowed. Use multiline strings to specify multiple files.
  * `files-dest`: Path of protected output
  * `jscrambler-version`: Jscrambler version to use
  * `protocol`, `host`, `path` and `base-path`: Alternative path of protection server
  * `source-maps-output-path`: Path of output source maps
  * `symbol-table-output-path`: Path of output symbol table
  * `debug-mode`: Whether to turn on debug mode

## Outputs

Jscrambler generates a `protection-id` as an output

## Usage

```yaml
uses: actions/jscrambler-github-action@v1.1
with:
  access-key: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  secret-key: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  application-id: 'ABC123GHI123MNO123TUV123'
```
