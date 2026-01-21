/**
 * Generates HTML content for the 3D world webview.
 */
import * as vscode from 'vscode';

/** CSS styles for the webview */
const STYLES = `
body { margin:0; padding:0; overflow:hidden; background-color:#87CEEB; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
#container { width:100vw; height:100vh; position:relative; }
#renderer { width:100%; height:100%; }
#ui-overlay { position:absolute; top:10px; left:10px; z-index:1000; color:#333; background: rgba(255,255,255,0.9); padding:12px; border-radius:8px; font-size:12px; box-shadow:0 2px 10px rgba(0,0,0,0.1); border:1px solid rgba(255,255,255,0.3); }
#version { font-size:11px; color:#666; margin-top:4px; padding-top:8px; border-top:1px solid #ddd; }
#loading { position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#333; background: rgba(255,255,255,0.95); padding:20px 30px; border-radius:10px; font-size:18px; z-index:1001; box-shadow:0 4px 20px rgba(0,0,0,0.1); }
.hidden { display:none; }
#controls-help { position:absolute; bottom:10px; left:10px; color:#333; background: rgba(255,255,255,0.9); padding:12px; border-radius:8px; font-size:11px; z-index:1000; box-shadow:0 2px 10px rgba(0,0,0,0.1); border:1px solid rgba(255,255,255,0.3); }
#perf-panel { position:absolute; top:10px; right:10px; background: rgba(0,0,0,0.6); color:white; font-size:12px; padding:8px; border-radius:6px; max-width:200px; z-index:1001; white-space:pre-line; }
`;

/** Controls help text */
const CONTROLS_HELP = `
<strong>Controls:</strong><br>
WASD - Move character<br>
Mouse - Look around (click to lock)<br>
Space - Jump (or up in flight mode)<br>
F - Toggle flight mode<br>
C - Down (flight mode only)<br>
ESC - Release mouse lock<br>
Click - Select object<br>
Double-click - Open files
`;

/**
 * Generate the webview HTML content
 */
export function generateWebviewHtml(
    rendererUri: vscode.Uri,
    cspSource: string,
    version: string
): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource} 'unsafe-inline'; style-src ${cspSource} 'unsafe-inline';">
<title>OpenAs3D - 3D World</title>
<style>${STYLES}</style>
</head>
<body>
<div id="container">
    <div id="loading">Initializing 3D World...</div>
    <div id="renderer"></div>
    <div id="ui-overlay">
        <div>OpenAs3D - Codebase Explorer</div>
        <div id="stats">Objects: 0 | FPS: 0</div>
        <div id="version">Build ${version}</div>
    </div>
    <div id="controls-help">${CONTROLS_HELP}</div>
    <div id="perf-panel">Perf: initializing...</div>
</div>
<script src="${rendererUri}"></script>
</body>
</html>`;
}
