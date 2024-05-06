---
"jscrambler": minor
---

Remove reference to unnecessary lib fs-extra in cli.
This library was making it harder than necessary to use this package in non-node contexts, but
removing it was a breaking change since it was unnecessarily exported in one of the files.
Since we're doing a breaking change anyway, this is a good opportunity to get rid of it.
This is only a breaking change for libraries that were importing sub-files from `jscrambler` directly.
