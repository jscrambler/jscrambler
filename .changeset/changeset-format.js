// Based on @changesets/changelog-git

const getReleaseLine = async (
  changeset,
  _type
) => {
  const [firstLine, ...futureLines] = changeset.summary
    .split("\n")
    .map((l) => l.trimRight());

  let returnVal = `- [${
    changeset.commit ? changeset.commit.slice(0, 7) : ""
  }]: ${firstLine}`;

  if (futureLines.length > 0) {
    returnVal += `\n${futureLines.map((l) => `  ${l}`).join("\n")}`;
  }

  return returnVal;
};

const getDependencyReleaseLine = async (
  changesets,
  dependenciesUpdated
) => {
  if (dependenciesUpdated.length === 0) return "";

  const uniqueCommits = new Set(
    changesets.map((changeset) => changeset.commit?.slice(0, 7)).filter((commit) => commit)
  );

  const updatedDependenciesList = dependenciesUpdated.map(
    (dependency) => `  - ${dependency.name}@${dependency.newVersion}`
  );

  return [`- [${[...uniqueCommits]}]: Updated dependencies`, ...updatedDependenciesList].join("\n");
};

module.exports = {
  getReleaseLine,
  getDependencyReleaseLine,
};
