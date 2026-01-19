import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WebviewPanelManager } from './webview/panel';
import { ExtensionLoader } from './visualizers/loader';
import { PerfTracker } from './utils/perf-tracker';
import { FileSystemHelper } from './utils/file-system';

let webviewPanelManager: WebviewPanelManager;
let extensionLoader: ExtensionLoader;
const perf = new PerfTracker();

export function activate(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension('openas3d.openas3d-vscode');
    const version = extension?.packageJSON?.version || '0.0.0';
    console.log(`OpenAs3D extension is now active! (Build ${version})`);

    // Initialize managers
    webviewPanelManager = new WebviewPanelManager(context, version);
    extensionLoader = new ExtensionLoader(context);

    // Register commands
    const exploreDependenciesCommand = vscode.commands.registerCommand(
        'openas3d.exploreDependencies',
        async (uri?: vscode.Uri) => {
            try {
                await handleExploreDependencies(uri);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to explore dependencies: ${error}`);
            }
        }
    );

    const openAs3DWorldCommand = vscode.commands.registerCommand(
        'openas3d.openAs3DWorld',
        async () => {
            try {
                await handleOpenAs3DWorld();
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open 3D world: ${error}`);
            }
        }
    );

    context.subscriptions.push(exploreDependenciesCommand);
    context.subscriptions.push(openAs3DWorldCommand);

    vscode.window.showInformationMessage('OpenAs3D extension activated! Use "Explore Dependencies in 3D" to get started.');
}

async function handleExploreDependencies(uri?: vscode.Uri) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('Please open a workspace folder to explore dependencies.');
        return;
    }

    const targetPath = uri?.fsPath || workspaceFolder.uri.fsPath;

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Analyzing codebase dependencies...",
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: "Scanning files..." });

        // ───── Track panel creation ─────
        const tPanel = perf.start('createOrShowPanel');
        const panel = await webviewPanelManager.createOrShowPanel();
        perf.stop('createOrShowPanel', tPanel);

        // Hook into webview messages
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'addSignAtPosition') {
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

                webviewPanelManager.sendMessage({
                    type: 'addObject',
                    data: {
                        id: `sign-${timestamp}`,
                        type: 'sign',
                        filePath,
                        position: message.data.position,
                        description: text,
                        color: 0xFFDD00
                    }
                });
            }
        });

        // ───── Set UI callback for live perf display ─────
        perf.setUICallback(report => {
            webviewPanelManager.sendMessage({
                type: 'perfUpdate',
                data: { report }
            });
        });

        progress.report({ increment: 50, message: "Initializing 3D world..." });

        // ───── Track codebase visualizer load ─────
        const tVisualizer = perf.start('loadCodebaseVisualizer');

        // Before loading, we read file contents and pass to metadata
        const allFiles = await FileSystemHelper.getFilesRecursively(
            vscode.Uri.file(targetPath),
            ['.ts','.tsx','.js','.jsx','.py','.java','.go','.cs','.cpp','.c','.h','.json','.md']
        );

        const fileMetadataMap: { [filePath: string]: any } = {};
        for (const fileUri of allFiles) {
            try {
                const content = await FileSystemHelper.readFileContent(fileUri);
                const stats = await FileSystemHelper.getFileStat(fileUri);
                const language = FileSystemHelper.getLanguageId(fileUri);

                fileMetadataMap[fileUri.fsPath] = {
                    content,
                    size: stats.size,
                    lastModified: stats.mtime,
                    language,
                    lines: content.split('\n').length
                };
            } catch (err) {
                console.warn(`Failed to read file for metadata: ${fileUri.fsPath}`, err);
            }
        }

        // Pass metadataMap to visualizer through loader
        await extensionLoader.loadCodebaseVisualizer(panel, targetPath);
        // After panel is ready, send each file with its content
        for (const filePath in fileMetadataMap) {
            webviewPanelManager.sendMessage({
                type: 'addObject',
                data: {
                    id: filePath.replace(/[^a-zA-Z0-9]/g, '_'),
                    type: 'file',
                    filePath,
                    position: { x: Math.random() * 20 - 10, y: 0, z: Math.random() * 20 - 10 },
                    metadata: fileMetadataMap[filePath]
                }
            });
        }

        perf.stop('loadCodebaseVisualizer', tVisualizer);

        progress.report({ increment: 100, message: "Complete!" });

        // ───── Log final performance report to console as well ─────
        perf.report();
    });
}

async function handleOpenAs3DWorld() {
    await handleExploreDependencies();
}

export function deactivate() {
    console.log('OpenAs3D extension is being deactivated');

    if (webviewPanelManager) {
        webviewPanelManager.dispose();
    }

    if (extensionLoader) {
        extensionLoader.dispose();
    }
}
