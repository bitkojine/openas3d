---
status: generated
lastUpdated: 2026-01-18T00:00:00Z
---

# WebviewPanelManager.ts

## Summary
This class manages the OpenAs3D 3D world panel inside VS Code.  
It handles panel lifecycle, webview content, messaging between the extension and webview, and opening source files alongside mirrored description files.  
It also watches `.3d-descriptions` markdown files for changes and updates the 3D world labels dynamically.  

## Responsibilities
- **Panel lifecycle**: create, reveal, dispose.
- **Webview content**: inject HTML, scripts, styles, and Three.js renderer.
- **Message handling**: object selection, open files, errors, and readiness.
- **File integration**: open code and mirrored description files in VS Code.
- **Description watching**: automatically updates floating labels when description files change.
- **Error handling**: reports failures to open files or read description files.

## Usage
- Double-click a code object in the 3D world to open its code + description.
- The floating label above each code object shows the summary and status.
- Updates automatically when `.3d-descriptions` files are changed, created, or deleted.

## Key Metadata
- Auto-generated for 3D visualization of code objects.
- Keeps description separate from source code.
- Helps display status: `missing`, `generated`, `reconciled`.
