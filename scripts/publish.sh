#!/bin/bash

set -euo pipefail

if (( $# != 1 )); then
  echo "Usage: $(basename -- "$0") <pack-dir-artifact>" >&2
  exit 1
fi

script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly script_dir

root_dir="$(cd -- "${script_dir}/.." && pwd)"
readonly root_dir

pack_out_dir="${root_dir}/$1"
readonly pack_out_dir

packages_dir="${pack_out_dir}/packages"
readonly packages_dir

publish_plan_path="${pack_out_dir}/publish-plan.json"
readonly publish_plan_path

publish_report_script_path="${script_dir}/build-publish-report-line.mjs"
readonly publish_report_script_path

# allows empty packages array
shopt -s nullglob
packages=("${packages_dir}"/*.tgz)

if (( ${#packages[@]} == 0 )); then
  echo "No .tgz packages found in ${packages_dir}" >&2
  exit 1
fi

if [[ -z "${CHANGESETS_OUTPUT:-}" ]]; then
  echo "CHANGESETS_OUTPUT is required" >&2
  exit 1
fi

: >> "${CHANGESETS_OUTPUT}"

# PUBLISH to stage
for package in "${packages[@]}"; do
  tarball_path="packages/$(basename -- "${package}")"
  publish_entry="$(node "${publish_report_script_path}" "${publish_plan_path}" "${tarball_path}")"
  IFS=$'\t' read -r integrity output_line <<< "${publish_entry}"

  echo "Staging $(basename -- "${package}") with integrity ${integrity}..."
  pnpm stage publish "${package}" --publish-branch release/staged
  printf '%s\n' "${output_line}" >> "${CHANGESETS_OUTPUT}"
done
