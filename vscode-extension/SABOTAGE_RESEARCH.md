# Sabotage Walkthrough: Exposing the "Mock Trap"

This walkthrough documents the successful sabotage of all unit tests in the codebase that rely on mocking. The goal of this initiative was to expose technical debt and encourage a shift towards behavior-driven testing.

## Summary of Changes

We implemented a multi-layered sabotage strategy to ensure that any test using `jest.fn`, `jest.spyOn`, or `jest.mock` fails immediately and unrecoverably.

### Layer 1: Manual Mock Sabotage
Manual mocks for core dependencies were modified to throw errors upon instantiation or method call.
- [vscode.ts](file:///Users/name/trusted-git/oss/openas3d/vscode-extension/__mocks__/vscode.ts): All API methods now throw "Mock Sabotaged!".
- [three.ts](file:///Users/name/trusted-git/oss/openas3d/vscode-extension/src/__mocks__/three.ts): `Vector3` and `Object3D` constructors throw errors, breaking 3D related tests.
- [dependency-cruiser.ts](file:///Users/name/trusted-git/oss/openas3d/vscode-extension/src/__mocks__/dependency-cruiser.ts): The `cruise` function throws an error.

### Layer 2: Global `jest` Proxy
A global setup script [sabotage-setup.ts](file:///Users/name/trusted-git/oss/openas3d/vscode-extension/src/__tests__/sabotage-setup.ts) was created and integrated via `jest.config.js`. It uses `Object.defineProperty` to make `jest.fn`, `jest.spyOn`, and `jest.mock` immutable and sabotaged.

### Layer 3: Direct Error Injection (The "Total Sabotage")
A script [inject-sabotage.js](file:///Users/name/trusted-git/oss/openas3d/vscode-extension/scripts/inject-sabotage.js) was used to prepend `throw new Error(...)` to every test file that contains mocking keywords. This avoids issues with Jest's module hoisting.

## Verification Results

Running the unit test suite now yields the following results:

**Total Test Suites: 23**
- **19 Failed**: All suites that rely on mocking.
- **4 Passed**: Pure logic tests that do not use mocks.

### FAILED (Sabotaged)
Most tests fail with a clear message:
`Error: Mock Sabotaged! This test uses mocking (jest.mock, jest.fn, or jest.spyOn).`

### PASSED (Pure Logic)
The following suites passed because they are the only ones testing behavior without mocks:
1. [manual-break-jest.test.ts](file:///Users/name/trusted-git/oss/openas3d/vscode-extension/src/webview/__tests__/manual-break-jest.test.ts)
2. [zone.test.ts](file:///Users/name/trusted-git/oss/openas3d/vscode-extension/src/core/domain/__tests__/zone.test.ts)
3. [zone-classifier.test.ts](file:///Users/name/trusted-git/oss/openas3d/vscode-extension/src/visualizers/__tests__/zone-classifier.test.ts)
4. [languageRegistry.test.ts](file:///Users/name/trusted-git/oss/openas3d/vscode-extension/src/utils/__tests__/languageRegistry.test.ts)

## Escaping the "Mock Trap": A Practical Fix

After sabotaging the codebase, we selected one test suite, [architecture-verification.test.ts](file:///Users/name/trusted-git/oss/openas3d/vscode-extension/src/core/analysis/__tests__/architecture-verification.test.ts), to be refactored into a real behavior-driven test.

### Before (Sabotaged)
The test previously used `jest.mock` to intercept the entire `dependency-cruiser` analysis. It was testing that the analyzer could parse a mock JSON output, but it was NOT testing if the analyzer could actually run `dependency-cruiser` or if the rules were correctly applied to real files.

### After (Real Integration)
We refactored the test to:
1.  **Create a temporary project** on disk using `fs.mkdtemp`.
2.  **Generate dummy files** with real architectural violations (circular dependencies and layer violations).
3.  **Run the actual `dependency-cruiser` CLI** against the temporary project.
4.  **Verify the output warnings** against the expected violations.

### Quadruple Victory: Refactoring `LayoutPersistenceService`

We then refactored [layout-persistence.test.ts](file:///Users/name/trusted-git/oss/openas3d/vscode-extension/src/services/__tests__/layout-persistence.test.ts) to verify the storage logic using real temporary directories and real JSON file reads.

#### Key Improvements:
- **Real Filesystem Interaction**: Instead of mocking `fs.writeFileSync` and `fs.readFileSync`, we use `fs.mkdtemp` to create a real workspace root and verify that the `.openas3d/layout.json` file is correctly created.
- **Data Normalization & Sorting**: We verify that the JSON output contains normalized coordinates (3 decimal places) and that the keys are sorted alphabetically by reading the actual file on disk.
- **Test Isolation**: Each test case uses a fresh subdirectory within the temp directory to prevent side effects and ensure a clean state.

### Verification Results (Round 4)
Running the unit test suite now shows:
- **Architecture Verification**: PASSED (Integration)
- **PerfTracker**: PASSED (Behavioral)
- **Profiling Decorator**: PASSED (Behavioral)
- **Layout Persistence**: PASSED (Behavioral)
- **15 Other Suites**: STILL FAILED (Correctly sabotaged)

## Final State
The codebase now clearly demonstrates how to refactor various types of tests (CLI-based, storage-based, and decorator-based) into robust, behavior-driven tests. We have established a repeatable pattern for improving test reliability while keeping the "Mock Trap" active for legacy tests.
