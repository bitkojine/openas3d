/**
 * Generates HTML content for the 3D world webview.
 */
import * as vscode from 'vscode';

/** CSS styles for the webview */
const STYLES = `
body { margin:0; padding:0; overflow:hidden; background-color:#87CEEB; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; user-select: none; }
#container { width:100vw; height:100vh; position:relative; }
#renderer { width:100%; height:100%; }

/* Minimal Stats Bar */
#stats-bar {
    position: absolute;
    top: 15px;
    left: 20px;
    z-index: 1000;
    display: flex;
    align-items: center;
    gap: 15px;
    background: rgba(15, 23, 42, 0.8);
    backdrop-filter: blur(4px);
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #94a3b8;
    font-size: 11px;
    font-family: 'Consolas', monospace;
    pointer-events: none;
}
#stats { color: #e2e8f0; }
#version { opacity: 0.5; font-size: 10px; }

#loading { position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#333; background: rgba(255,255,255,0.95); padding:20px 30px; border-radius:10px; font-size:18px; z-index:1001; box-shadow:0 4px 20px rgba(0,0,0,0.1); }
.hidden { display:none; }
#controls-help { 
    position:absolute; bottom:20px; left:20px; 
    color:#cbd5e1; background: rgba(15, 23, 42, 0.9); 
    padding:14px; border-radius:12px; font-size:11px; z-index:1000; 
    box-shadow:0 4px 16px rgba(0,0,0,0.3); 
    border:1px solid rgba(255,255,255,0.1); 
    pointer-events: none;
    backdrop-filter: blur(4px);
    line-height: 1.6;
}
#perf-panel { 
    position:absolute; top:20px; right:20px; 
    background: rgba(0,0,0,0.5); color:#aaa; 
    font-size:10px; padding:6px; border-radius:4px; 
    z-index:1001; pointer-events: none;
}
`;

/** Controls help text */
const CONTROLS_HELP = `
<div style="margin-bottom:8px; font-weight:600; color:#fff; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:4px;">Controls</div>
<div style="display:grid; grid-template-columns: auto 1fr; gap: 4px 12px;">
    <span style="color:#94a3b8">WASD</span> <span>Move character</span>
    <span style="color:#94a3b8">Mouse</span> <span>Look around</span>
    <span style="color:#94a3b8">Space</span> <span>Jump / Fly Up</span>
    <span style="color:#94a3b8">C</span> <span>Fly Down</span>
    <span style="color:#94a3b8">Click</span> <span>Select Object</span>
    <span style="color:#94a3b8">Double</span> <span>Open File</span>
    <span style="color:#94a3b8">F</span> <span>Toggle Flight</span>
    <span style="color:#94a3b8">E</span> <span>Sign Mode (Click to Place)</span>
    <span style="color:#94a3b8">Esc</span> <span>Release Cursor</span>
</div>
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
    
    <div id="stats-bar">
        <span id="stats">Objects: 0 | FPS: 0</span>
        <span id="version">v${version}</span>
    </div>

    <div id="controls-help">${CONTROLS_HELP}</div>
    <div id="perf-panel"></div>
</div>
<script src="${rendererUri}"></script>
</body>
</html>`;
}

