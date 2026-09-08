// Schema in https://github.com/changesets/changesets/blob/5e54cd97cabac92f02d1c6f4439ac226e347d9bf/packages/cli/src/utils/output.ts
import { readFileSync } from "node:fs";

const [publishPlanPath, tarballPath] = process.argv.slice(2);

if (!publishPlanPath || !tarballPath) {
    throw new Error(
        "Usage: build-publish-report-line.mjs <publish-plan-path> <tarball-path>",
    );
}

const publishPlan = JSON.parse(readFileSync(publishPlanPath, "utf8"));
const entry = publishPlan.plan
    .flat()
    .find(
        ({ kind, tarball }) =>
            kind === "publish" && tarball?.path === tarballPath,
    );

if (!entry) {
    throw new Error(`Tarball is missing from the publish plan: ${tarballPath}`);
}

const { name, version, tarball } = entry;
const outputLine = JSON.stringify({
    type: "git-tag",
    tag: `${name}@${version}`,
    packageName: name,
});

process.stdout.write(`${tarball.integrity}\t${outputLine}`);
