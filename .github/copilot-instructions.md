# OpenAs3D - AI Coding Instructions

## Project Overview

OpenAs3D is a VSCode extension that transforms codebases into interactive 3D worlds for spatial code exploration. Instead of traditional flat file trees, developers walk through code using WASD controls like a video game, where **height = complexity** and **color = language**. The extension analyzes dependencies, visualizes architectural relationships, and makes code discovery memorable through spatial awareness.

## Architecture Layers

### 1. **VSCode Extension Layer** (`vscode-extension/src/`)
- **Entry point**: `extension.ts` - Registers commands, manages lifecycle
- **Command handlers**: `openas3d.exploreDependencies` (main feature), `openas3d.openAs3DWorld`
- **Extension loads from context on startup** - Uses `onStartupFinished` activation event
- **Two core managers**:
  - `WebviewPanelManager` - Creates/manages 3D webview panel, handles VSCode↔Webview messaging
  - `ExtensionLoader` - Loads visualizers (currently built-in, extensible for plugins)

### 2. **Visualization Engine** (`src/visualizers/`)
- **CodebaseVisualizer** - Core analyzer implementing `WorldVisualizer` interface
  - Recursively scans workspace for source files (.ts, .js, .py, .java, .go, .cs, .cpp, .c, .h)
  - **Parses imports via regex** - Extracts dependencies from import/require statements
  - Builds dependency graph: `files` (Map of CodeFile) + `edges` (import relationships)
  - Sends graph to webview for rendering
- **Manifest pattern** - Each visualizer declares metadata (name, type, languages, version)
- **Extensibility** - `ExtensionLoader` discovers visualizers from `extensions/` directory (future feature)

### 3. **3D Rendering** (`src/webview/`)
- **WebGL via Three.js** - Uses Three.js library for 3D graphics
- **WorldRenderer** class manages:
  - **Scene setup** - Bright daytime sky (0x87CEEB blue), fog for atmosphere
  - **Code visualization** - Files as 3D boxes with properties:
    - **Position** - Clustered by architectural relationships
    - **Height** - Cyclomatic complexity (complex = tall)
    - **Size** - File size (larger = wider box)
    - **Color** - Language color (TS=blue, JS=yellow, etc.)
  - **Dependency edges** - Lines/curves connecting import relationships
  - **Raycasting** - Detects object selection via mouse clicks
- **Webview isolation** - Sandboxed from main extension; communicates via `postMessage`

### 4. **Character-Based Navigation** (`src/webview/renderer.ts`)
- **First-person physics system** - Not just camera movement; simulates character
  - **Position separate from camera** - `characterPosition` + eye offset
  - **Velocity & acceleration** - Smooth momentum-based movement
  - **Gravity simulation** - Character stays on ground unless jumping/flying
  - **Ground collision** - Detects when standing on objects (height=0.5)
- **Movement modes**:
  - **Walking** - WASD moves relative to look direction, gravity active, Space=jump
  - **Flight** - Press F toggle, no gravity, Space/C for vertical movement
- **Mouse look** - Yaw/pitch rotation with pointer lock (click to lock, ESC to unlock)
- **FPS-like controls** - Inspired by game engines, feels intuitive to developers

## Key Patterns & Conventions

### Dependency Graph Construction
- **Extract imports via regex** on file content (not AST parsing for simplicity)
- **Relative path resolution** - Handles `../` and `@/` imports
- **Language-agnostic** - Same extraction logic for all supported languages
- **Edge cases** - Dynamic imports, barrel files, index.ts re-exports may be incomplete

### Message Protocol (VSCode↔Webview)
Extension sends:
```typescript
{ type: 'visualize', data: { graph: DependencyGraph } }
```
Webview sends back:
```typescript
{ type: 'objectSelected', data: { filePath, type } }
{ type: 'openFile', data: { filePath } }
{ type: 'error', data: { message } }
```

### Color Coding Strategy
Language → RGB color mapping in renderer (TS=#3178C6 blue, JS=#F7DF1E yellow, etc.)
Used for visual language distinction; helps developers instantly recognize tech stacks.

## Development Workflow

### Setup & Build
```bash
cd vscode-extension
npm install                    # Install webpack, three.js, @types/vscode, etc.
npm run compile                # Webpack build (production)
npm run watch                  # Dev watch mode
npm run dev                    # Dev build without watch
```

### Running the Extension
1. **From VSCode**: Open `vscode-extension/` folder, press **F5** → Extension Development Host launches
2. **Test in demo**: Inside host, open `demo-project/` folder, run "Explore Dependencies in 3D" command
3. **Check console**: Extension Host output shows analysis logs and errors

### Packaging & Distribution
```bash
npm run vscode:prepublish      # Production-ready compile
npm run package                # Generate .vsix file (VSCode extension package)
npm run publish                # Publish to VSCode marketplace (requires auth)
```

### Common Development Tasks
- **Edit extension commands**: `extension.ts` - register commands + handlers
- **Fix visualization bugs**: `webview/renderer.ts` - Three.js rendering logic
- **Improve analysis**: `visualizers/codebase.ts` - dependency extraction regex
- **Add new language**: Update supported extensions in `findSourceFiles()`, add color in renderer
- **Webview UI changes**: `webview/panel.ts` - getWebviewContent() returns HTML/CSS/JS

## Critical Integration Points

### VSCode API Usage
- **Commands**: `vscode.commands.registerCommand()` for user actions
- **Webview**: `vscode.window.createWebviewPanel()` with security settings (enableScripts, localResourceRoots)
- **File system**: `fs` module for scanning workspace, limited to workspace root
- **User feedback**: `vscode.window.showInformationMessage()`, `showErrorMessage()`, `showWarningMessage()`

### Webview Context Restrictions
- **No direct filesystem access** - Webview can't read files; extension reads and sends data
- **No require() of VSCode API** - Webview is sandboxed; uses `acquireVsCodeApi()` messaging
- **Resource paths** - Must map extension paths to webview URIs via `panel.webview.asWebviewUri()`

### Three.js Patterns
- **Scene setup** - Lighting (ambient + directional), fog, background color
- **Geometry** - Use `BoxGeometry` for files, `LineGeometry` for dependencies
- **Materials** - Standard or Lambert materials with emissive colors for language coloring
- **Animation loop** - `requestAnimationFrame` in `animate()` method

## Performance Considerations

- **File scanning**: Recursive directory traversal can be slow on large codebases; consider cached analysis
- **Dependency parsing**: Regex extraction is fast but misses dynamic/complex requires
- **3D rendering**: WebGL supports ~10K+ objects; large codebases may need clustering/LOD (Level of Detail)
- **Webview memory**: Retains context when hidden (`retainContextWhenHidden: true`); useful for preserving state

## Test Fixtures

- **demo-project**: Small realistic TypeScript app (User/UserService pattern) - used for testing visualization
- **enterprise-demo**: Larger structure with multiple modules (auth, order, product) - demonstrates complex architectures

## File Reference Map

| Purpose | Key Files |
|---------|-----------|
| Command entry | `src/extension.ts` |
| Webview UI | `src/webview/panel.ts` |
| 3D rendering | `src/webview/renderer.ts` |
| Code analysis | `src/visualizers/codebase.ts` |
| Visualizer system | `src/visualizers/loader.ts` |
| Extension config | `package.json` (commands, menus, settings) |

## Known Limitations & Gaps

1. **Dynamic imports** - Only static import/require statements detected
2. **Barrel exports** - Re-exports via index.ts not fully analyzed
3. **Circular dependencies** - Detected but not specially visualized
4. **Large codebases** - Performance degrades >5K files; needs culling/clustering
5. **Real-time updates** - Changes to files don't auto-refresh; requires restart

## Next Development Priorities

- Collision detection for walking into code objects
- Audio feedback (footsteps, click sounds)
- Search/filter functionality in 3D world
- Export dependency diagrams as images
- Integration with code metrics (test coverage, lint scores)
