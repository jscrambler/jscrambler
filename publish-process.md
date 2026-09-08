# Publish process

This document describes the release and package-publishing flow implemented by
`.github/workflows/release.yaml` and `scripts/publish.sh`.

## Overview

The `Release` GitHub Actions workflow runs on every push to `master`. Changesets
first selects one of two modes:

1. **Version mode** creates or updates the version-bump pull request.
2. **Publish mode** packs the packages, publishes the generated tarballs to the
   staging branch, and pushes the corresponding Git tags.

Only one run for the same workflow and Git ref can execute at a time because the
workflow uses `${{ github.workflow }}-${{ github.ref }}` as its concurrency key.

## Shared setup

Each job:

- obtains a GitHub token from the Code Integrity GitHub App;
- checks out the repository without persisting Git credentials; and
- installs pnpm 11, Node.js 24, and the project dependencies.

The workflow starts with no default permissions and grants only the permissions
needed by each job.

## 1. Select the Changesets mode

The `select-mode` job runs `changesets/action/select-mode`. It exposes:

- `mode`, which determines whether the workflow versions or publishes; and
- `publish-plan-artifact-id`, used later to build the exact packages in the
  publish plan.

## 2a. Version mode

When the selected mode is `version`, the `version` job runs
`changesets/action/version`. It applies the pending Changesets, commits the
version updates with `chore(changeset): bump versions`, and creates or updates a
pull request titled `[Changeset] Bump Versions`.

Publishing does not happen in this run. Once the version changes reach `master`,
a subsequent workflow run can select publish mode.

## 2b. Publish mode: pack

When the selected mode is `publish`, the `pack` job passes the publish-plan
artifact to `changesets/action/pack`. The action builds the package tarballs and
returns a `pack-dir` artifact ID for the publish job.

## 3. Publish the packed tarballs

The `publish` job downloads the pack artifact into:

```text
tmp/changeset-pack-dir/
├── publish-plan.json
└── packages/
    └── *.tgz
```

It then runs `changesets/action/publish` with `pnpm ci:publish`. That package
script invokes:

```bash
./scripts/publish.sh tmp/changeset-pack-dir
```

GitHub releases are disabled, while Git tag pushing is enabled. The job has
`contents: write` for tags and `id-token: write` for trusted publishing.

## What `publish.sh` does

The script accepts exactly one argument: the path, relative to the repository
root, of the downloaded pack directory. It expects that directory to contain
`publish-plan.json` and a `packages` directory containing `.tgz` files.

For every tarball, the script:

1. Builds its publish-plan path as `packages/<tarball-name>.tgz`.
2. Calls `scripts/build-publish-report-line.mjs` to find the matching publish
   entry, read the tarball integrity recorded in `publish-plan.json`, and
   generate a Changesets output record for the package's
   `<package-name>@<version>` Git tag.
3. Logs the integrity returned by the helper before staging the tarball.
4. Publishes the tarball with:

   ```bash
   pnpm stage publish <tarball>
   ```

5. Appends the generated Git-tag record to `CHANGESETS_OUTPUT`, allowing
   `changesets/action/publish` to push the tags after the script succeeds.

`CHANGESETS_OUTPUT` is supplied by the Changesets publish action. The script
creates the output file if needed. If no `.tgz` files exist, it reports that fact
and exits successfully without publishing anything.

The script uses `set -euo pipefail`, so an invalid argument, a missing publish
plan entry, or a failed publish stops the process immediately. Packages are
published sequentially; the Changesets tag record is written only after the
corresponding staging publish succeeds.

## End-to-end flow

```text
Push to master
      |
      v
Select Changesets mode
      |
      +-- version --> update versions --> open/update version PR
      |
      `-- publish --> pack planned packages --> download pack artifact
                                               |
                                               v
                                      stage each .tgz
                                               |
                                               v
                                      report and push Git tags
```
