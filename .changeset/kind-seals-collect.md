---
"jscrambler": major
---

Addition of a new flag `--delete-protection-on-success` that allows for the deletion of a protection after it has been run and was successful.
By default `--delete-protection-on-success` is set to `false` and must be explicitly set to `true`.

This flag was added in order to delete successful protections after the files were downloaded: protections might not be needed anymore after being used one single time and will take up space unnecessarily.
