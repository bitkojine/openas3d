import * as vscode from 'vscode';
import * as path from 'path';
// fs removed
import { getLanguageDisplayName, getLanguageFromExtension } from '../utils/languageRegistry';
import { generateWebviewHtml } from './webview-template';
import { ExtensionMessage, WebviewMessage, isWebviewMessage } from '../shared/messages';

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

        this.isReady = false; // Reset readiness
        return this.panel;
    }

    private setupDescriptionWatcher() {
        if (!vscode.workspace.workspaceFolders) { return; }

        const pattern = new vscode.RelativePattern(vscode.workspace.workspaceFolders[0], '**/*');
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

        const updateDescription = async (uri: vscode.Uri) => {
            try {
                let content = '';
                let summaryText = '';
                let status: 'missing' | 'generated' | 'reconciled' = 'missing';

                try {
                    const doc = await vscode.workspace.openTextDocument(uri);
                    content = doc.getText();
                    const summaryMatch = content.match(/## Summary\s+([\s\S]*?)(\n##|$)/i);
                    summaryText = summaryMatch ? summaryMatch[1].trim() : '';
                    const statusMatch = content.match(/status:\s*(\w+)/i);
                    status = statusMatch ? (statusMatch[1] as any) : 'missing';
                } catch (e) {
                    // File might not exist or be readable, handled below
                }

                if (!summaryText && this.panel) {
                    if (!vscode.workspace.workspaceFolders) return; // Guard
                    // We need to resolve the code file that corresponds to this potential description file
                    // The logic below originally assumed 'uri' was the description file.
                    // Let's preserve logic: uri is the file trigger.
                    const filePath = uri.fsPath.replace(/\.md$/, '');
                    const codeUri = vscode.Uri.file(filePath); // Construct URI from path

                    try {
                        const stats = await vscode.workspace.fs.stat(codeUri);
                        const size = stats.size;
                        // mtime is number (ms since epoch)
                        const lastModified = new Date(stats.mtime).toLocaleDateString('lt-LT', { timeZone: 'Europe/Vilnius' });
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
                    } catch (e) {
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

    public sendMessage(message: ExtensionMessage): void {
        if (this.panel) {
            this.panel.webview.postMessage(message);
        }
    }

    public dispatchMessage(message: ExtensionMessage): void {
        this.panel?.webview.postMessage(message);
    }

    public waitForMessage(type: string): Promise<any> {
        return new Promise(resolve => {
            this.messageWaiters.push({ type, resolve });
        });
    }

    private isReady = false;

    public async ensureReady(): Promise<void> {
        if (this.isReady) { return; }
        await this.waitForMessage('ready');
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
        this.watcher?.dispose();
        this.watcher = undefined;
    }

    private handleWebviewMessage(message: WebviewMessage): void {
        // Init Check waiters
        const waiterIndex = this.messageWaiters.findIndex(w => w.type === message.type);
        if (waiterIndex !== -1) {
            const waiter = this.messageWaiters[waiterIndex];
            this.messageWaiters.splice(waiterIndex, 1);
            // Not all messages have data, so safely pass undefined if missing
            waiter.resolve('data' in message ? message.data : undefined);
            // Stop processing if it's a test message we were waiting for
            if (message.type.startsWith('TEST_')) { return; }
        }

        // Also ignore fire-and-forget test messages that might arrive late
        if (message.type.startsWith('TEST_')) { return; }

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
                break;
            case 'error':
                vscode.window.showErrorMessage(`3D World Error: ${message.data.message}`);
                break;
            case 'objectFocused':
                this.handleObjectFocused(message.data);
                break;
            case 'log':
                // Webview logs forwarded - can be enabled for debugging
                break;
            default:
                console.log('Unknown message from webview:', message);
        }
    }

    private async handleObjectFocused(_data: any): Promise<void> {
        // No-op: visual highlighting is handled internally by the webview
    }

    private async handleObjectSelected(data: any): Promise<void> {
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
        if (!data.filePath) { return; }

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

            // Check existence using stat
            try {
                await vscode.workspace.fs.stat(codeUri);
            } catch {
                vscode.window.showWarningMessage(`File does not exist: ${data.codeFile}`);
                return;
            }

            const codeDoc = await vscode.workspace.openTextDocument(codeUri);
            await vscode.window.showTextDocument(codeDoc, { preview: false });

            const descUri = vscode.Uri.file(data.codeFile.endsWith('.md') ? data.codeFile : data.codeFile + '.md');

            try {
                await vscode.workspace.fs.stat(descUri);
                // If stat succeeds, it exists
                const descDoc = await vscode.workspace.openTextDocument(descUri);
                await vscode.window.showTextDocument(descDoc, { preview: false });
            } catch {
                // Description file doesn't exist, ignore
            }

        } catch (err) {
            vscode.window.showErrorMessage(`Failed to open files: ${err}`);
        }
    }

    private async handleAddSign(data: { position: { x: number; y: number; z: number } }) {
        if (!vscode.workspace.workspaceFolders?.length) { return; }
        const workspaceFolder = vscode.workspace.workspaceFolders[0];

        const text = await vscode.window.showInputBox({ prompt: 'Enter sign text (short message)' });
        if (!text) { return; }

        const signsDir = vscode.Uri.joinPath(workspaceFolder.uri, 'signs');
        try {
            await vscode.workspace.fs.createDirectory(signsDir);
        } catch (e) {
            // Include error handling if needed, but createDirectory succeeds if dir exists
        }

        const timestamp = Date.now();
        const fileName = `sign-${timestamp}.md`;
        const fileUri = vscode.Uri.joinPath(signsDir, fileName);

        const content = `---
status: missing
lastUpdated: ${new Date().toISOString()}
---

# ${text}
## Summary
${text}
`;
        const encoder = new TextEncoder();
        await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));

        this.panel?.webview.postMessage({
            type: 'addObject',
            data: {
                id: `sign-${timestamp}`,
                type: 'sign',
                filePath: fileUri.fsPath, // Webview still needs path for internal logic, or does it need URI? visualizer uses fsPath usually.
                position: data.position,
                description: text,
                color: 0xFFDD00
            }
        });
    }

    private getWebviewContent(): string {
        const jsPath = path.join(this.context.extensionPath, 'out', 'webview', 'renderer.js');

        const rendererUri = this.panel!.webview.asWebviewUri(
            vscode.Uri.file(jsPath)
        );

        return generateWebviewHtml(rendererUri, this.panel!.webview.cspSource, this.version);
    }
}
