---
status: generated
lastUpdated: 2026-01-18T00:00:00Z
---

# WebviewPanelManager

## Summary
Manages the lifecycle, messaging, and integration of the OpenAs3D webview panel in VS Code. Responsible for creating and disposing the panel, handling messages between the webview and the extension, opening source and description files, and keeping descriptions up-to-date in the 3D world.

## Key Responsibilities
- **Lifecycle Management**: Creates or restores the webview panel and disposes it cleanly on close.
- **Webview Messaging**: Handles incoming messages (`objectSelected`, `openFile`, `openFiles`, `ready`, `error`) and dispatches updates to VS Code.
- **Description Synchronization**: Ensures `.3d-descriptions` mirror exists, reads summary for 3D world labels, and watches for updates.
- **Editor Integration**: Opens code and description files side-by-side using VS Code APIs.
- **3D World Integration**: Sends updates to the webview to display file summaries and statuses above 3D code objects.

## Notes
- Watches `.3d-descriptions/**/*.md` files to auto-update floating labels in the world.
- Description status can be `missing`, `generated`, or `reconciled`.
- Placeholder descriptions are automatically created if missing.
