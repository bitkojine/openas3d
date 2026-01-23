
# Architecture Decisions

## Dependency-Cruiser Integration (Analysis Engine)

We integrate `dependency-cruiser` to provide architecture analysis (circular dependencies, layering violations, etc.). 

### The Challenge: ESM vs CommonJS
The VSCode Extension Host runs in a **CommonJS** environment. However, `dependency-cruiser` is a pure **ESM** package that strictly exports itself as a module. Attempting to dynamic `import()` it or bundle it via Webpack results in failures because the extension environment cannot legally load the ESM entry point.

### The Solution: Out-of-Process Execution
To bypass this limitation, we execute `dependency-cruiser` as a **separate child process** using the CLI binary.

1.  **Spawn**: We use `child_process.spawn` to run the `dependency-cruiser` CLI binary found in `node_modules`.
2.  **Path Resolution**: The `extensionPath` is passed from the extension context to reliable locate the binary in both development and production (packaged) modes.
3.  **JSON Output**: We capture the `stdout` from the process, which is formatted as JSON, and parse it to extracting warnings and violations.

### Benefits
*   **Isolation**: The heavy static analysis runs in its own process, preventing it from blocking the main extension thread.
*   **Stability**: Avoids fragile Webpack configurations or "eval" hacks to force ESM loading.
*   **Standard Usage**: Uses the library as intended (via CLI), ensuring compatibility with its standard configuration files.
