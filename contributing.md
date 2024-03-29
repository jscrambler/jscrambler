# Development

  * Use the commit guidelines in https://www.conventionalcommits.org/en/v1.0.0/#summary
  * Name your development branches something like `feat/<feature>`. The prefix follows the same general idea as the conventional commit prefix.
  * Try to respect our coding guidelines. Our eslint configuration should help here.
  * Include a changeset for your changes. Run `pnpm changeset` at the root of the repository for this.

# Releases

There is a GitHub action that takes care of that. Merge the "Update versions" Pull Request and the action will take care of the rest.

# Manual Releases

If for some reason the automatic GitHub action isn't working, it's possible to do a manual release.

  1. Verify that your `.npmrc` file is correctly configured and that you can push changes to NPM.
  2. Apply the changesets as needed (`pnpm changeset version`). Review that everything worked well.
  3. Commit and push.
  4. Perform `pnpm changeset publish`
