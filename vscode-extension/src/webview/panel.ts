import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class WebviewPanelManager {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private version: string;
    private watcher: vscode.FileSystemWatcher | undefined;

    constructor(context: vscode.ExtensionContext, version: string = '0.0.0') {
        this.context = context;
        this.version = version;
    }

    public async createOrShowPanel(): Promise<vscode.WebviewPanel> {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (this.panel) {
            this.panel.reveal(columnToShowIn);
            return this.panel;
        }

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

        this.panel.webview.html = this.getWebviewContent();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
            this.watcher?.dispose();
            this.watcher = undefined;
        }, null, this.context.subscriptions);

        this.panel.webview.onDidReceiveMessage(
            message => this.handleWebviewMessage(message),
            undefined,
            this.context.subscriptions
        );

        this.setupDescriptionWatcher();

        return this.panel;
    }

    private setupDescriptionWatcher() {
        if (!vscode.workspace.workspaceFolders) return;

        const pattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '**/*.md');
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

        const updateDescription = (uri: vscode.Uri) => {
            try {
                let content = '';
                let summaryText = '';
                let status: 'missing' | 'generated' | 'reconciled' = 'missing';

                if (fs.existsSync(uri.fsPath)) {
                    content = fs.readFileSync(uri.fsPath, 'utf-8');
                    const summaryMatch = content.match(/## Summary\s+([\s\S]*?)(\n##|$)/i);
                    summaryText = summaryMatch ? summaryMatch[1].trim() : '';
                    const statusMatch = content.match(/status:\s*(\w+)/i);
                    status = statusMatch ? (statusMatch[1] as any) : 'missing';
                }

                // Fallback to metadata if no Markdown summary
                if (!summaryText && this.panel) {
                    const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
                    const filePath = uri.fsPath.replace(/\.md$/, ''); // original code file

                    if (fs.existsSync(filePath)) {
                        const stats = fs.statSync(filePath);
                        const size = stats.size;
                        const lastModified = stats.mtime.toLocaleDateString();
                        const ext = path.extname(filePath);
                        const languageMap: { [key: string]: string } = {
                            '.ts': 'TypeScript', '.tsx': 'TypeScript',
                            '.js': 'JavaScript', '.jsx': 'JavaScript',
                            '.py': 'Python', '.java': 'Java',
                            '.go': 'Go', '.cs': 'C#',
                            '.cpp': 'C++', '.c': 'C', '.h': 'C'
                        };
                        const language = languageMap[ext] || 'unknown';

                        const complexity = size / 50; // crude proxy metric

                        // --- NEW: multi-line metadata format ---
                        summaryText = [
                            `Filename: ${path.basename(filePath)}`,
                            `Language: ${language}`,
                            `Size: ${size} bytes`,
                            `Complexity: ${Math.round(complexity)}`,
                            `Last Modified: ${lastModified}`
                        ].join('\n');

                        status = 'generated';
                    } else {
                        summaryText = 'No description available';
                    }
                }

                this.panel?.webview.postMessage({
                    type: 'updateObjectDescription',
                    data: {
                        filePath: uri.fsPath,
                        description: {
                            summary: summaryText,
                            status
                        }
                    }
                });
            } catch (err) {
                console.error('Failed to read description file for update:', uri.fsPath, err);
            }
        };

        this.watcher.onDidCreate(updateDescription);
        this.watcher.onDidChange(updateDescription);
        this.watcher.onDidDelete(uri => {
            this.panel?.webview.postMessage({
                type: 'updateObjectDescription',
                data: {
                    filePath: uri.fsPath,
                    description: {
                        summary: 'No description yet.',
                        status: 'missing'
                    }
                }
            });
        });
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
        this.watcher?.dispose();
        this.watcher = undefined;
    }

    private handleWebviewMessage(message: any): void {
        switch (message.type) {
            case 'objectSelected':
                this.handleObjectSelected(message.data);
                break;
            case 'openFile':
                this.handleOpenFile(message.data);
                break;
            case 'openFiles':
                this.handleOpenFiles(message.data);
                break;
            case 'addSignAtPosition':
                this.handleAddSign(message.data);
                break;
            case 'ready':
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
        console.log('Object selected:', data);
        if (data.filePath) {
            vscode.window.showInformationMessage(
                `Selected: ${path.basename(data.filePath)} (${data.type})`
            );
        }
    }

    private async handleOpenFile(data: any): Promise<void> {
        if (!data.filePath) return;

        try {
            const uri = vscode.Uri.file(data.filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to open file: ${error}`);
        }
    }

    private async handleOpenFiles(data: { codeFile: string }): Promise<void> {
        try {
            const codeUri = vscode.Uri.file(data.codeFile);

            if (!fs.existsSync(codeUri.fsPath)) {
                vscode.window.showWarningMessage(`File does not exist: ${data.codeFile}`);
                return;
            }

            const codeDoc = await vscode.workspace.openTextDocument(codeUri);
            await vscode.window.showTextDocument(codeDoc, { preview: false });

            const descUri = vscode.Uri.file(data.codeFile.endsWith('.md') ? data.codeFile : data.codeFile + '.md');
            if (fs.existsSync(descUri.fsPath)) {
                const descDoc = await vscode.workspace.openTextDocument(descUri);
                await vscode.window.showTextDocument(descDoc, { preview: false });
            }
        } catch (err) {
            vscode.window.showErrorMessage(`Failed to open files: ${err}`);
        }
    }

    private async handleAddSign(data: { position: { x: number; y: number; z: number } }) {
        if (!vscode.workspace.workspaceFolders?.length) return;
        const workspaceFolder = vscode.workspace.workspaceFolders[0];

        const text = await vscode.window.showInputBox({ prompt: 'Enter sign text (short message)' });
        if (!text) return;

        const signsDir = path.join(workspaceFolder.uri.fsPath, 'signs');
        fs.mkdirSync(signsDir, { recursive: true });

        const timestamp = Date.now();
        const fileName = `sign-${timestamp}.md`;
        const filePath = path.join(signsDir, fileName);

        const content = `---
status: missing
lastUpdated: ${new Date().toISOString()}
---

# ${text}
## Summary
${text}
`;
        fs.writeFileSync(filePath, content, { encoding: 'utf-8' });

        this.panel?.webview.postMessage({
            type: 'addObject',
            data: {
                id: `sign-${timestamp}`,
                type: 'sign',
                filePath,
                position: data.position,
                description: text,
                color: 0xFFDD00
            }
        });
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
body { margin:0; padding:0; overflow:hidden; background-color:#87CEEB; font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
#container { width:100vw; height:100vh; position:relative; }
#renderer { width:100%; height:100%; }
#ui-overlay { position:absolute; top:10px; left:10px; z-index:1000; color:#333; background: rgba(255,255,255,0.9); padding:12px; border-radius:8px; font-size:12px; box-shadow:0 2px 10px rgba(0,0,0,0.1); border:1px solid rgba(255,255,255,0.3); }
#version { font-size:11px; color:#666; margin-top:4px; padding-top:8px; border-top:1px solid #ddd; }
#loading { position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); color:#333; background: rgba(255,255,255,0.95); padding:20px 30px; border-radius:10px; font-size:18px; z-index:1001; box-shadow:0 4px 20px rgba(0,0,0,0.1); }
.hidden { display:none; }
#controls-help { position:absolute; bottom:10px; left:10px; color:#333; background: rgba(255,255,255,0.9); padding:12px; border-radius:8px; font-size:11px; z-index:1000; box-shadow:0 2px 10px rgba(0,0,0,0.1); border:1px solid rgba(255,255,255,0.3); }
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
        Double-click - Open files
    </div>
</div>
<script src="${rendererUri}"></script>
</body>
</html>`;
    }
}
