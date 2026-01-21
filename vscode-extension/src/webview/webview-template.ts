/**
 * Generates HTML content for the 3D world webview.
 */
import * as vscode from 'vscode';

/** CSS styles for the webview */
const STYLES = `
body { margin:0; padding:0; overflow:hidden; background-color:#87CEEB; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; user-select: none; }
#container { width:100vw; height:100vh; position:relative; }
#renderer { width:100%; height:100%; }

/* UI Overlay Glass Panel */
#ui-overlay { 
    position:absolute; top:20px; left:20px; z-index:1000; 
    color:#eee; background: rgba(30, 30, 35, 0.95); 
    padding:16px; border-radius:12px; font-size:12px; 
    box-shadow:0 8px 32px rgba(0,0,0,0.3); 
    border:1px solid rgba(255,255,255,0.1); 
    backdrop-filter: blur(8px);
    display: flex; flex-direction: column; gap: 8px;
    min-width: 200px;
}

/* Stats Section */
#stats { 
    display: flex; flex-direction: column; gap: 4px;
    font-family: 'Consolas', monospace;
    font-size: 11px;
    color: #aaa;
    border-bottom: 1px solid rgba(255,255,255,0.1);
    padding-bottom: 8px;
    margin-bottom: 8px;
}

/* Legend Section */
.legend-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 12px;
    align-items: center;
    font-size: 11px;
    margin-top: 4px;
}
.legend-item { display: flex; flex-direction: column; justify-content: center; }
.legend-title { font-weight: 600; color: #eee; }
.legend-desc { font-size: 9px; color: #888; margin-top: -2px; }
.legend-icon { 
    width: 20px; height: 20px; 
    display: flex; align-items: center; justify-content: center;
    border-radius: 6px; font-weight: bold; font-size: 12px;
}

/* Status Colors */
.status-hot { color: #00bfff; border: 1px solid #00bfff; background: rgba(0, 191, 255, 0.1); }
.status-circular { color: #ff4444; border: 1px solid #ff4444; background: rgba(255, 68, 68, 0.1); }
.status-leaf { color: #7cfc00; border: 1px solid #7cfc00; background: rgba(124, 252, 0, 0.1); }
.status-root { color: #ffd700; border: 1px solid #ffd700; background: rgba(255, 215, 0, 0.1); }

#version { font-size:10px; color:#555; margin-top:8px; text-align: right; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; }
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
    <span style="color:#94a3b8">Click</span> <span>Select Object</span>
    <span style="color:#94a3b8">Double</span> <span>Open File</span>
    <span style="color:#94a3b8">F</span> <span>Toggle Flight</span>
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
    
    <div id="ui-overlay">
        <div style="font-weight:600; font-size:14px; margin-bottom:2px; letter-spacing: 0.5px;">Codebase Vis</div>
        
        <div id="stats">
            <div>Objects: 0</div>
            <div>FPS: 0</div>
        </div>

        <div class="legend-grid">
            <div class="legend-icon status-hot">⚡</div> 
            <div class="legend-item">
                <div class="legend-title">Hot File</div>
                <div class="legend-desc">Many imports (>5)</div>
            </div>

            <div class="legend-icon status-circular">∞</div> 
            <div class="legend-item">
                <div class="legend-title">Circular</div>
                <div class="legend-desc">Infinite loop risk</div>
            </div>

            <div class="legend-icon status-root">◈</div> 
            <div class="legend-item">
                <div class="legend-title">Root</div>
                <div class="legend-desc">Starting point</div>
            </div>

            <div class="legend-icon status-leaf">○</div> 
            <div class="legend-item">
                <div class="legend-title">Leaf</div>
                <div class="legend-desc">End of chain</div>
            </div>
        </div>

        <div id="version">v${version}</div>
    </div>

    <div id="controls-help">${CONTROLS_HELP}</div>
    <div id="perf-panel"></div>
</div>
<script src="${rendererUri}"></script>
</body>
</html>`;
}
