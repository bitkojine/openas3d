# ESLint Hardening Specification (v2)

This document outlines the phased plan to transition the `openas3d-vscode` extension from "warning-tolerant" to "strict-error" linting. 

## Current Baseline (on `main`)
The following issues were identified after re-enabling recommended rules:
- **Major Issues**: `no-explicit-any` (316), `no-unused-vars` (71)
- **Moderate Issues**: `no-inferrable-types` (40), `no-non-null-assertion` (32), `no-empty-function` (22)
- **Minor Issues**: `ban-ts-comment` (6), `no-var-requires` (6), `no-case-declarations` (5), `prefer-const` (2), `no-empty` (1), `no-async-promise-executor` (1), `no-throw-literal` (1)

## Phase 1: Global Rule Hardening & Critical Fixes
Turning high-impact but low-volume rules into errors immediately.

- **Commit 1: Set All Targeted Rules to "Error" & Unmask Suppressions**
  - Update `.eslintrc.json` to set all current warnings to `"error"`.
  - Remove all current `eslint-disable`, `@ts-ignore`, and `@ts-expect-error` comments (11 found).
  - Goal: Establish a truly honest baseline of all violations.
- **Commit 2: Fix Simple Core Errors (Minor Set)**
  - Address: `no-case-declarations`, `no-empty`, `no-async-promise-executor`, `prefer-const`.
  - Scope: ~10 instances.
- **Commit 3: Modernize Imports (`no-var-requires`)**
  - Resolution: Convert `require` to ES `import`.
  - Scope: 6 instances.

## Phase 2: Structural & Stylistic Cleanup
Addressing the moderate volume rules.

- **Commit 4: Satisfy `no-empty-function`**
  - Resolution: Add `// Intentionally empty` comments to constructors and callbacks.
  - Scope: 22 instances.
- **Commit 5: Resolve `no-non-null-assertion`**
  - Resolution: Replace `!` with proper guard clauses or safe navigation.
  - Scope: 34 instances.
- **Commit 6: Clean up `no-inferrable-types`**
  - Resolution: Remove redundant type annotations like `: string = ''`.
  - Scope: 40 instances.
- **Commit 7: Resolve `no-unused-vars`**
  - Resolution: Remove unused imports/variables or prefix with `_`.
  - Scope: 77 instances.

## Phase 3: The `any` Cleanup (`no-explicit-any`)
Addressing the largest challenge (322 instances) incrementally by module.

- **Commit 8: Fix `any` in `src/utils` and `src/shared`**
- **Commit 9: Fix `any` in `src/core` (Domain & Analysis)**
- **Commit 10: Fix `any` in `src/services` (Extension Core)**
- **Commit 11: Fix `any` in `src/webview` (Part 1: Logic/State)**
- **Commit 12: Fix `any` in `src/webview` (Part 2: Rendering/UI)**
- **Commit 13: Fix `any` in Tests & Mocks**

## Verification Strategy

Each commit must meet these criteria:
1. `npm run lint` shows **zero errors** for the specific rule(s) addressed.
2. `npm run compile` passes.
3. `npm run test` passes (all unit tests).
