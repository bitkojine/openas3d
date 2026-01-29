# **The Mock Trap: Why and How to Avoid It**

## **What is the Mock Trap?**

The "Mock Trap" occurs when we use mocks (specifically `jest.mock`, `jest.spyOn`, etc.) to replace real dependencies to the point where our tests are no longer validating behavior, but rather validating that our mocks are configured correctly.

When you fall into the mock trap:
- Tests pass but the code fails in production.
- Refactoring becomes impossible because tests are tied to implementation details.
- Coverage metrics are high but confidence is low.

---

## **Root Causes**

### **1. Testing Tooling Defaults**
Jest makes mocking **too easy**. IDE auto-completion and online tutorials often suggest mocking everything by default.

### **2. Misunderstanding Test Purpose**
We often test **implementation details** (is this function called?) instead of **behavior** (does this input produce this output?).

### **3. Fear of Dependencies**
We mock because we're afraid of "messy" things like the file system, git commands, or console output.
> [!IMPORTANT]
> These are the **exact things we should be testing**. Mocking them removes most of the test's value.

### **4. "Isolation" Misconception**
Isolation means **controlling inputs**, not **mocking everything**. Control the file content via real temporary files or dependency injection, don't mock the `fs` module.

---

## **Prevention Strategies**

### **1. The "No Mock First" Rule**
Write the test without ANY mocks first. Only add mocks if the test fails due to a truly external, uncontrollable dependency (like a network call to a third-party service).

### **2. Test Behavior, Not Implementation**
- ❌ **Don't**: Check if `DEBUG_PATTERNS` contains a specific regex.
- ✅ **Do**: Provide a file with that pattern and verify it's detected.

### **3. Dependency Inversion**
If logic is hard to test without mocks, rethink the design. Instead of reading from `fs` inside the function, pass the content as a parameter.

```javascript
// ❌ Hard to test without mocking fs
function checkFile(path) {
  const content = fs.readFileSync(path);
  // ... logic
}

// ✅ Easy to test with real data
function checkContent(content) {
  // ... logic
}
```

### **4. The "Real Data" Test**
Always include at least one test that uses real data from the file system or environment.

---

## **Mock Review Checklist**

Before adding a mock, ask:
1. **Am I testing the real algorithm?** or just my ability to mock it?
2. **Would this test catch a real bug?** If the logic changes but the mock remains, will it still pass?
3. **Is this mock hiding the implementation?** If I change how the function works internally, will I have to rewrite the mock?
4. **Is there a way to control the input instead?** (e.g., using a temp directory instead of mocking `fs`).

---

## **Summary**

**Stop testing the implementation. Start testing the behavior.**

Real tests answer: "Does this actually work?"
Mocked tests answer: "Does my mock return what I told it to return?"

**Test the real thing, control the inputs, verify the outputs.**
