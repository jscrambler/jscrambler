# jscrambler

## 8.8.4

### Patch Changes

- [7415ef5]: Prepend multiple file in jscrambler-cli

## 8.8.3

### Patch Changes

- [5a5c256]: Bump axios due to vuln

## 8.8.2

### Patch Changes

- [34adf8d]: Change Example language

## 8.8.1

### Patch Changes

- [a5f9ae7]: Document globalNamesPrefix parameter

## 8.8.0

### Minor Changes

- [477066b]: Added globalNamesPrefix config option to cli

## 8.7.1

### Patch Changes

- [3ef818f]: Update readme.md

## 8.7.0

### Minor Changes

- [d0b95d7]: Added metadata report feature on cli

## 8.6.6

### Patch Changes

- [57d7550]: fix compatibility of cwd and beforeProtection options

## 8.6.5

### Patch Changes

- [a50925a]: Downgrade glob to allow support node.js v14

## 8.6.4

### Patch Changes

- [c2aada1]: it was necessary to override the version of the package cross-spawn to fix its vulnerability

## 8.6.3

### Patch Changes

- [294d182]: Fix axios vulnerability

## 8.6.2

### Patch Changes

- [ab4eb68]: added core-js dependency as it was wrongfully removed previously

## 8.6.1

### Patch Changes

- [bf31071]: bump glob dependency version as 8.1.0 is no longer supported
- [dadea38]: remove unused dependencies, and bump others, specially due to vulnerabilites

## 8.6.0

### Minor Changes

- [051fda1]: Added --save-src flag to control sources storage behavior.

## 8.5.1

### Patch Changes

- [ae6b6fb]: Update README

## 8.5.0

### Minor Changes

- [188894f]: Add new Mode option, validations and send it to mutations

## 8.4.2

### Patch Changes

- [8e2ec8d]: bump http&https-proxy-agent libs

## 8.4.1

### Patch Changes

- [4db3431]: Fix folder creation bug

## 8.4.0

### Minor Changes

- [033fd40]: Prevents accidental breakage due to changes in internal files.
  This requires node 12, which we already do.
- [691d53b]: Remove reference to unnecessary lib fs-extra in cli.
  This library was making it harder than necessary to use this package in non-node contexts, but
  removing it was a breaking change since it was unnecessarily exported in one of the files.
  Since we're doing a breaking change anyway, this is a good opportunity to get rid of it.
  This is only a breaking change for libraries that were importing sub-files from `jscrambler` directly.
- [73d973b]: Make CLI compatible with newer API, drop compatibility with older ones.

## 8.1.2

### Patch Changes

- [be8825b]: Make fs promises compatible with older node versions

## 8.1.1

### Patch Changes

- [5bb3289]: Added proxy protocol option

## 8.1.0

### Minor Changes

- [4752980]: Add the ability to instrument the app from the config file - instrument: true

## 8.0.1

### Patch Changes

- [56e65d9]: Added async behaviour to delete protection on success.

## 8.0.0

### Major Changes

- [542cef9]: Added the newly developed `--delete-protection-on-success` flag to the README.

## 7.0.0

### Major Changes

- [26fdf6e]: Addition of a new flag `--delete-protection-on-success` that allows for the deletion of a protection after it has been run and was successful.
  By default `--delete-protection-on-success` is set to `false` and must be explicitly set to `true`.

  This flag was added in order to delete successful protections after the files were downloaded: protections might not be needed anymore after being used one single time and will take up space unnecessarily.

### Patch Changes

- [6758a7f]: Better package metadata. This may assist tooling like Renovate bot.

## 6.4.28

### Patch Changes

- [3d3cfc6]: Possibility to append or prepend scripts to specific files

## 6.4.27

### Patch Changes

- [c346840]: Use private key for tagging

## 6.4.26

### Patch Changes

- [f5882d4]: Update release process

## 6.4.25

### Patch Changes

- [a9fe25b]: Improve release process

## 6.4.24

### Patch Changes

- [2bd7a39]: update release process

## 6.4.23

### Patch Changes

- [5cbeccd]: Set access to public on publishConfig

## 6.4.22

### Patch Changes

- [4fa2580]: Adjust transpilation settings to generate better code
- [4fa2580]: Infrastructure updates
