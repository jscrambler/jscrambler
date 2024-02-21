# jscrambler

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
