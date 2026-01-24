/**
 * Generates HTML content for the 3D world webview.
 */
import * as vscode from 'vscode';

/** CSS styles for the webview */
// VSCode Theme Colors
// - --vscode-editor-background
// - --vscode-editor-foreground
// - --vscode-widget-shadow
// - --vscode-editorWidget-background
// - --vscode-editorWidget-border
const STYLES = `
body { margin:0; padding:0; overflow:hidden; background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); user-select: none; }
#container { width:100vw; height:100vh; position:relative; }
#renderer { width:100%; height:100%; }

#loading { 
    position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); 
    color: var(--vscode-editor-foreground); 
    background: var(--vscode-editorWidget-background); 
    padding:20px 30px; border-radius:10px; font-size:18px; z-index:1001; 
    box-shadow:0 4px 20px var(--vscode-widget-shadow); 
    border: 1px solid var(--vscode-editorWidget-border);
}
.hidden { display:none !important; }

#controls-help { 
    position:absolute; bottom:20px; left:20px; 
    color: var(--vscode-descriptionForeground); 
    background: var(--vscode-editorWidget-background); 
    padding:14px; border-radius:12px; font-size:12px; z-index:1000; 
    box-shadow:0 4px 16px var(--vscode-widget-shadow); 
    border:1px solid var(--vscode-editorWidget-border); 
    pointer-events: none;
    backdrop-filter: blur(4px);
    line-height: 1.6;
}
#stats-panel { 
    position:absolute; top:20px; right:20px; 
    background: var(--vscode-editorWidget-background); 
    color: var(--vscode-editor-foreground); 
    font-size: 12px; font-family: var(--vscode-editor-font-family);
    padding: 0; border-radius: 8px;
    z-index:1001; pointer-events: auto;
    border: 1px solid var(--vscode-editorWidget-border);
    backdrop-filter: blur(4px);
    box-shadow: 0 4px 6px var(--vscode-widget-shadow);
    min-width: 300px;
}
#version-tag {
    position: absolute;
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--vscode-statusBar-background);
    color: var(--vscode-statusBar-foreground);
    padding: 2px 14px;
    border-radius: 12px;
    font-size: 10px;
    font-family: var(--vscode-editor-font-family);
    pointer-events: none;
    z-index: 1100;
    opacity: 1;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    font-weight: 800;
    box-shadow: 0 2px 4px var(--vscode-widget-shadow);
    border: 1px solid var(--vscode-statusBar-border);
}
#stats-panel table { width: 100%; border-collapse: collapse; font-size: 11px; }
#stats-panel th { text-align: left; padding: 3px 6px; border-bottom: 1px solid var(--vscode-editorWidget-border); color: var(--vscode-descriptionForeground); font-weight: 600; }
#stats-panel td { padding: 3px 6px; color: var(--vscode-editor-foreground); }

/* Theme-specific coloring for performance stats */
/* Dark Theme (Default) */
body.vscode-dark .row-slow { color: #ff6b6b; }
body.vscode-dark .row-medium { color: #feca57; }

/* Light Theme */
body.vscode-light .row-slow { color: #d32f2f; }
body.vscode-light .row-medium { color: #f57f17; }

/* High Contrast */
body.vscode-high-contrast .row-slow { color: #ff0000; }
body.vscode-high-contrast .row-medium { color: #ff8f00; }

/* Micro-Panels (Collapsible UI) */
.micro-panel {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    overflow: hidden;
}
.micro-panel.collapsed {
    width: 40px !important;
    height: 40px !important;
    min-width: 40px !important;
    min-height: 40px !important;
    max-height: 40px !important;
    padding: 0 !important;
    border-radius: 20px !important;
}
.micro-panel.collapsed > *:not(.micro-panel-header) {
    display: none !important;
}
.micro-panel.collapsed .micro-panel-header {
    border: none !important;
    padding: 8px !important;
    justify-content: center !important;
    height: 100% !important;
    box-sizing: border-box !important;
}
.micro-panel.collapsed .micro-panel-header h3 {
    display: none !important;
}
.micro-panel-toggle {
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s;
    font-size: 10px;
}
.micro-panel-toggle:hover {
    opacity: 1;
}
`;

/** Controls help text */
const CONTROLS_HELP = `
<div style="margin-bottom:8px; font-weight:600; color:var(--vscode-foreground); border-bottom:1px solid var(--vscode-editorWidget-border); padding-bottom:4px;">Controls</div>
<div style="display:grid; grid-template-columns: auto 1fr; gap: 4px 12px;">
    <span style="color:var(--vscode-descriptionForeground)">WASD</span> <span>Move character</span>
    <span style="color:var(--vscode-descriptionForeground)">Mouse</span> <span>Look around</span>
    <span style="color:var(--vscode-descriptionForeground)">Space</span> <span>Jump / Fly Up</span>
    <span style="color:var(--vscode-descriptionForeground)">C</span> <span>Fly Down</span>
    <span style="color:var(--vscode-descriptionForeground)">Click</span> <span>Select Object</span>
    <span style="color:var(--vscode-descriptionForeground)">Double</span> <span>Open File</span>
    <span style="color:var(--vscode-descriptionForeground)">F</span> <span>Toggle Flight</span>
    <span style="color:var(--vscode-descriptionForeground)">E</span> <span>Sign Mode (Click to Place)</span>
    <span style="color:var(--vscode-descriptionForeground)">Shift+Drag</span> <span>Move Object</span>
    <span style="color:var(--vscode-descriptionForeground)">Esc</span> <span>Release Cursor</span>
</div>
`;

/**
 * Generate the webview HTML content
 */
function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export function generateWebviewHtml(
    rendererUri: vscode.Uri,
    cspSource: string,
    version: string
): string {
    const nonce = getNonce();
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<!-- Use nonce for scripts and styles to avoid unsafe-inline -->
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource} 'nonce-${nonce}'; style-src ${cspSource} 'unsafe-inline';">
<title>OpenAs3D - 3D World</title>
<style>${STYLES}</style>
</head>
<body>
<div id="container">
    <div id="version-tag">Pre-Alpha v${version}</div>
    <div id="loading">Initializing 3D World...</div>
    <div id="renderer"></div>
    
    <!-- Dynamic UI Containers -->
    <div id="stats-panel" data-version="${version}"></div>
</div>
<!-- Pass nonce to script -->
<script nonce="${nonce}" src="${rendererUri}"></script>
</body>
</html>`;
}

