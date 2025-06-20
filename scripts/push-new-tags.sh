#!/bin/bash

set -euo pipefail

echo "🔍 Checking for new tags on HEAD not pushed to origin..."

# Get tags created on the current commit only
for tag in $(git tag --points-at HEAD); do
  if ! git ls-remote --tags origin | grep -q "refs/tags/${tag}$"; then
    echo "🚀 Pushing new tag: $tag"
    git push origin "$tag"
  else
    echo "✅ Tag already exists remotely, skipping: $tag"
  fi
done
