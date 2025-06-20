#!/bin/bash

set -euo pipefail

echo "🔍 Checking for local tags not pushed to origin..."

for tag in $(git tag); do
  if ! git ls-remote --tags origin | grep -q "refs/tags/${tag}$"; then
    echo "🚀 Pushing new tag: $tag"
    git push origin "$tag"
  else
    echo "✅ Tag already exists remotely, skipping: $tag"
  fi
done
