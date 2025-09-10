# GitHub Workflows

This directory contains GitHub Actions workflows for the jscrambler monorepo.

## Workflows

### `ci.yaml` - Continuous Integration
**Triggers:** Push to `master`, Pull Requests to `master`

Runs comprehensive testing and quality checks for the jscrambler-cli package:

#### Jobs:
1. **test** - Unit Tests
   - Runs on Node.js 18, 20, and 22
   - Builds jscrambler-cli package
   - Executes Jest unit tests (88 tests, 97% coverage)
   - Generates and uploads coverage reports
   - Displays coverage summary in workflow

2. **lint** - Code Quality
   - Runs ESLint on jscrambler-cli source code
   - Ensures code style compliance

3. **build-check** - Build Verification
   - Builds all packages (jscrambler-cli, jscrambler-webpack-plugin)
   - Verifies build outputs exist
   - Reports build status

#### Features:
- ✅ **Matrix Testing**: Tests against multiple Node.js versions
- ✅ **Dependency Caching**: Caches pnpm store for faster builds
- ✅ **Coverage Reports**: Generates and stores test coverage artifacts
- ✅ **Concurrency Control**: Cancels in-progress runs on new commits
- ✅ **Monorepo Support**: Properly handles pnpm workspace dependencies

### `release.yaml` - Package Publishing
**Triggers:** Push to `master`

Handles automated package publishing using changesets.

### `bumpCodeIntegrityAction.yaml` - External Action Updates
**Triggers:** Tags matching `jscrambler@*`

Updates external GitHub Actions repository with new jscrambler versions.

### `tag.yaml` - Git Tagging
**Triggers:** Various tag patterns

Handles git tag-related workflows.

## Development

### Running Tests Locally
```bash
cd packages/jscrambler-cli
pnpm run test           # Run tests
pnpm run test:watch     # Run tests in watch mode
pnpm run test:coverage  # Generate coverage report
```

### Building Packages
```bash
cd packages/jscrambler-cli
pnpm run build          # Build CLI package

cd packages/jscrambler-webpack-plugin
pnpm run build          # Build webpack plugin
```

### Linting
```bash
cd packages/jscrambler-cli
pnpm run eslint         # Check code style
pnpm run eslint:fix     # Fix code style issues
```