import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { getLanguageDisplayName, getLanguageFromExtension } from '../utils/languageRegistry';
import { generateWebviewHtml } from './webview-template';

export class WebviewPanelManager {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private version: string;
    private watcher: vscode.FileSystemWatcher | undefined;

    // For testing: allow waiting for specific message types
    private messageWaiters: Array<{ type: string; resolve: (data: any) => void }> = [];

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

        this.setupDescriptionWatcher();

        this.isReady = false; // Reset readiness
        return this.panel;
    }

    private setupDescriptionWatcher() {
        if (!vscode.workspace.workspaceFolders) return;

        const pattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '**/*');
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

                if (!summaryText && this.panel) {
                    const workspaceRoot = vscode.workspace.workspaceFolders![0].uri.fsPath;
                    const filePath = uri.fsPath.replace(/\.md$/, '');

                    if (fs.existsSync(filePath)) {
                        const stats = fs.statSync(filePath);
                        const size = stats.size;
                        const lastModified = stats.mtime.toLocaleDateString('lt-LT', { timeZone: 'Europe/Vilnius' });
                        const ext = path.extname(filePath);
                        const language = getLanguageDisplayName(getLanguageFromExtension(ext)) || 'Unknown';
                        const complexity = size / 50;

                        summaryText = [
                            `Filename: ${path.basename(filePath)}`,
                            `Language: ${language}`,
                            `Size: ${size.toLocaleString('lt-LT')} bytes`,
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
                        description: { summary: summaryText, status }
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
                data: { filePath: uri.fsPath, description: { summary: 'No description yet.', status: 'missing' } }
            });
        });
    }

    public sendMessage(message: any): void {
        if (this.panel) {
            this.panel.webview.postMessage(message);
        }
    }

    public dispatchMessage(message: any) {
        this.panel?.webview.postMessage(message);
    }

    public waitForMessage(type: string): Promise<any> {
        return new Promise(resolve => {
            this.messageWaiters.push({ type, resolve });
        });
    }

    private isReady = false;

    public async ensureReady(): Promise<void> {
        if (this.isReady) return;
        console.log('Waiting for webview to be ready...');
        await this.waitForMessage('ready');
        console.log('Webview is ready (ensureReady verified)');
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
        console.log('WebviewPanelManager received message:', message.type);
        // Init Check waiters
        const waiterIndex = this.messageWaiters.findIndex(w => w.type === message.type);
        if (waiterIndex !== -1) {
            const waiter = this.messageWaiters[waiterIndex];
            this.messageWaiters.splice(waiterIndex, 1);
            waiter.resolve(message.data);
            // Stop processing if it's a test message we were waiting for
            if (message.type.startsWith('TEST_')) return;
        }

        // Also ignore fire-and-forget test messages that might arrive late
        if (message.type.startsWith('TEST_')) return;

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
                this.isReady = true;
                console.log('Webview is ready');
                break;
            case 'perfUpdate':
                // Webview handles this in bootstrap.js, nothing needed here
                break;
            case 'error':
                vscode.window.showErrorMessage(`3D World Error: ${message.data.message}`);
                break;
            case 'objectFocused':
                this.handleObjectFocused(message.data);
                break;
            case 'log':
                console.log('[Webview]', message.data.message);
                break;
            default:
                console.log('Unknown message from webview:', message);
        }
    }

    private async handleObjectFocused(data: any): Promise<void> {
        // We no longer sync explorer on focus/look-at to prevent focus thrashing and movement interruption.
        // The webview handles the visual highlighting internally.
    }

    private async handleObjectSelected(data: any): Promise<void> {
        console.log('Object selected:', data);
        if (data.filePath) {
            try {
                const uri = vscode.Uri.file(data.filePath);
                await vscode.commands.executeCommand('revealInExplorer', uri);

                // Immediately return focus to the webview so the user can continue moving
                if (this.panel) {
                    this.panel.reveal(undefined, false);
                }
            } catch (error) {
                console.warn('Failed to reveal in explorer:', error);
            }
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
        const jsPath = path.join(this.context.extensionPath, 'out', 'webview', 'renderer.js');
        console.log('Renderer JS Path:', jsPath);
        console.log('Renderer JS Exists:', fs.existsSync(jsPath));

        const rendererUri = this.panel!.webview.asWebviewUri(
            vscode.Uri.file(jsPath)
        );
        console.log('Renderer URI:', rendererUri.toString());

        return generateWebviewHtml(rendererUri, this.panel!.webview.cspSource, this.version);
    }
}
