# CI Pipeline Specification

This document outlines the proposed changes to the GitHub Actions CI pipelines for `openas3d`. The goal is to separate long-running mutation tests from the core CI workflow to improve developer feedback loops.

## Current State

The current CI workflow (`ci.yml`) runs on every push and pull request. It performs the following steps:
1.  Checkout code.
2.  Setup Node.js.
3.  Install dependencies.
4.  Compile the project.
5.  Run unit tests (`npm test`).
6.  Run mutation tests (`npm run test:mutation`).

## Proposed Architecture

We will split the CI into two distinct workflows:

### 1. Core CI Workflow (`ci.yml`)

The Core CI workflow will focus on fast feedback for developers.

- **Trigger**: Every push and pull request to the `main` branch.
- **Jobs**:
    - **Build and Test**:
        - Install dependencies.
        - Compile.
        - Run unit tests and linting.
- **Goal**: Execution time < 5 minutes.

### 2. Mutation Testing Workflow (`mutation.yml`) [NEW]

The Mutation Testing workflow will handle the long-running exhaustive tests.

- **Trigger**:
    - On a schedule (e.g., nightly), only if the code has changed since the last run.
    - Manually via `workflow_dispatch`.
    - **Optional**: On pull requests that target `main`, but as a non-blocking or separate check that can be run on demand.

### GitHub Action: Mutation Pipeline

A new file `.github/workflows/mutation.yml` will be created with change detection logic.

```yaml
name: Mutation Testing

on:
  schedule:
    - cron: '0 2 * * *' # Run at 02:00 UTC every day
  workflow_dispatch: # Allow manual trigger

jobs:
  check-changes:
    runs-on: ubuntu-latest
    outputs:
      should_run: ${{ steps.check.outputs.should_run }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - id: check
        run: |
          if [ "${{ github.event_name }}" = "workflow_dispatch" ]; then
            echo "should_run=true" >> $GITHUB_OUTPUT
          else
            # For scheduled runs, check if there are commits since last successful run or within last 24h
            # Simplified approach: check if any commits in last 24h
            COMMITS=$(git log --since="24 hours ago" --oneline)
            if [ -n "$COMMITS" ]; then
              echo "should_run=true" >> $GITHUB_OUTPUT
            else
              echo "should_run=false" >> $GITHUB_OUTPUT
            fi
          fi

  mutation-test:
    needs: check-changes
    if: needs.check-changes.outputs.should_run == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Use Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '22.x'
          cache: 'npm'
          cache-dependency-path: vscode-extension/package-lock.json
      - name: Install dependencies
        run: npm install
        working-directory: vscode-extension
      - name: Compile
        run: npm run compile
        working-directory: vscode-extension
      - name: Run mutation tests
        run: npm run test:mutation -- --mutate "src/utils/**/*.ts","src/services/**/*.ts"
        working-directory: vscode-extension
```

### Updates to `ci.yml`

The `Run mutation tests` step will be removed from `.github/workflows/ci.yml`.

## Benefits

- **Faster PR Checks**: Developers get results from unit tests quickly.
- **Resource Optimization**: Mutation tests, which are computationally expensive, run during off-peak hours or only when requested.
- **Specialized Reporting**: Dedicated workflows can have dedicated reporting artifacts for mutation results.
