#!/bin/bash

set -eu -o pipefail

pnpm changeset version
pnpm install
git add .changeset pnpm-lock.yaml
git commit -m "chore: release new version"
git push
pnpm publish -r
