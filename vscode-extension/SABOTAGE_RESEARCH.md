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

## Next Steps
The extent of the "Mock Trap" has been revealed. 19 out of 23 test suites are essentially placeholders for real behavior testing. These should be refactored to use real implementations or proper dependency injection where appropriate.
