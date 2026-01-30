---
description: How to avoid the "Mock Trap" when writing tests in this repository.
---

Follow these steps when writing or modifying tests to ensure you don't fall into the mock trap.

### 1. Identify the Behavior
Before writing any test code, define the **behavior** you are testing.
- ❌ **Wrong**: "I need to mock `fs.readFileSync` and return 'test data'."
- ✅ **Right**: "I need to verify that a file containing 'test data' is processed correctly."

### 2. Try "No Mock First"
// turbo
1. Write the test without any `jest.mock` or `jest.spyOn`.
2. Use real files (in a temporary directory if needed).
3. Use real environment variables.
4. If the test fails, analyze **why**.

### 3. Choose Realism Over Isolation
If the test fails because of a dependency, try to **control the input** instead of **mocking the dependency**.
- Use `memfs` or `tmp` for file system operations.
- Provide real configuration objects instead of mocking the config service.
- Use `nock` or a local server for network calls if possible.

### 4. Consult the Guide
Read the [Anti-Mock Guide](file:///Users/name/trusted-git/oss/openas3d/docs/ANTI_MOCK_TRAP.md) for detailed examples and rationale.

### 5. Verify the Mock
If you **must** use a mock, ask yourself:
1. Would this test still fail if I broke the actual implementation?
2. Is the mock just a copy-paste of the implementation?
3. Can I replace this mock with a real object that has specific inputs?

### 6. Run the Mock Check
// turbo
Run the following command to see if your test uses high-risk mocking patterns:
```bash
npm run check-mocks
```
(Note: Run this from the `vscode-extension` directory or root as configured).
