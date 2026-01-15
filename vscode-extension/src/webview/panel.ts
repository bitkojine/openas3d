import * as vscode from 'vscode';
import * as path from 'path';

export class WebviewPanelManager {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private version: string;

    constructor(context: vscode.ExtensionContext, version: string = '0.0.0') {
        this.context = context;
        this.version = version;
    }

    public async createOrShowPanel(): Promise<vscode.WebviewPanel> {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (this.panel) {
            // If panel already exists, show it
            this.panel.reveal(columnToShowIn);
            return this.panel;
        }

        // Create new panel
        this.panel = vscode.window.createWebviewPanel(
            'openas3d-world',
            'OpenAs3D - 3D World',
            columnToShowIn || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'out')),
                    vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview'))
                ]
            }
        );

        // Set the HTML content
        this.panel.webview.html = this.getWebviewContent();

        // Handle panel disposal
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        }, null, this.context.subscriptions);

        // Handle messages from webview
        this.panel.webview.onDidReceiveMessage(
            message => this.handleWebviewMessage(message),
            undefined,
            this.context.subscriptions
        );

        return this.panel;
    }

    public sendMessage(message: any): void {
        if (this.panel) {
            this.panel.webview.postMessage(message);
        }
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }

    private handleWebviewMessage(message: any): void {
        switch (message.type) {
            case 'objectSelected':
                this.handleObjectSelected(message.data);
                break;
            case 'openFile':
                this.handleOpenFile(message.data);
                break;
            case 'ready':
                // Webview is ready to receive data
                console.log('Webview is ready');
                break;
            case 'error':
                vscode.window.showErrorMessage(`3D World Error: ${message.data.message}`);
                break;
            default:
                console.log('Unknown message from webview:', message);
        }
    }

    private async handleObjectSelected(data: any): Promise<void> {
        // Handle object selection in 3D world
        console.log('Object selected:', data);
        
        // Could highlight related files in explorer, show metadata, etc.
        if (data.filePath) {
            // Show information about the selected file
            vscode.window.showInformationMessage(
                `Selected: ${path.basename(data.filePath)} (${data.type})`
            );
        }
    }

    private async handleOpenFile(data: any): Promise<void> {
        if (data.filePath) {
            try {
                const uri = vscode.Uri.file(data.filePath);
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open file: ${error}`);
            }
        }
    }

    private getWebviewContent(): string {
        const rendererUri = this.panel!.webview.asWebviewUri(
            vscode.Uri.file(path.join(this.context.extensionPath, 'out', 'webview', 'renderer.js'))
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${this.panel!.webview.cspSource} 'unsafe-inline'; style-src ${this.panel!.webview.cspSource} 'unsafe-inline';">
    <title>OpenAs3D - 3D World</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            overflow: hidden;
            background-color: #87CEEB;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        
        #container {
            width: 100vw;
            height: 100vh;
            position: relative;
        }
        
        #renderer {
            width: 100%;
            height: 100%;
        }
        
        #ui-overlay {
            position: absolute;
            top: 10px;
            left: 10px;
            z-index: 1000;
            color: #333;
            background: rgba(255, 255, 255, 0.9);
            padding: 12px;
            border-radius: 8px;
            font-size: 12px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
        
        #version {
            font-size: 11px;
            color: #666;
            margin-top: 4px;
            padding-top: 8px;
            border-top: 1px solid #ddd;
        }
        
        #loading {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: #333;
            background: rgba(255, 255, 255, 0.95);
            padding: 20px 30px;
            border-radius: 10px;
            font-size: 18px;
            z-index: 1001;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        }
        
        .hidden {
            display: none;
        }
        
        #controls-help {
            position: absolute;
            bottom: 10px;
            left: 10px;
            color: #333;
            background: rgba(255, 255, 255, 0.9);
            padding: 12px;
            border-radius: 8px;
            font-size: 11px;
            z-index: 1000;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }
    </style>
</head>
<body>
    <div id="container">
        <div id="loading">Initializing 3D World...</div>
        <div id="renderer"></div>
        <div id="ui-overlay">
            <div>OpenAs3D - Codebase Explorer</div>
            <div id="stats">Objects: 0 | FPS: 0</div>
            <div id="version">Build ${this.version}</div>
        </div>
        <div id="controls-help">
            <strong>Controls:</strong><br>
            WASD - Move character<br>
            Mouse - Look around (click to lock)<br>
            Space - Jump (or up in flight mode)<br>
            F - Toggle flight mode<br>
            C - Down (flight mode only)<br>
            ESC - Release mouse lock<br>
            Click - Select object<br>
            Double-click - Open file
        </div>
    </div>
    
    <script src="${rendererUri}"></script>
</body>
</html>`;
    }
}