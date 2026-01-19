import * as vscode from 'vscode';
import * as path from 'path';
import { WebviewPanelManager } from './webview/panel';
import { ExtensionLoader } from './visualizers/loader';
import { PerfTracker } from './utils/perf-tracker';

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

    context.subscriptions.push(exploreDependenciesCommand, openAs3DWorldCommand);

    vscode.window.showInformationMessage(
        'OpenAs3D extension activated! Use "Explore Dependencies in 3D" to get started.'
    );
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
        title: 'Analyzing codebase dependencies...',
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: 'Initializing 3D world...' });

        // ───── Create or reveal the panel ─────
        const tPanel = perf.start('createOrShowPanel');
        const panel = await webviewPanelManager.createOrShowPanel();
        perf.stop('createOrShowPanel', tPanel);

        // Listen for sign placement messages
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'addSignAtPosition') {
                await handleAddSign(message.data.position, workspaceFolder.uri.fsPath);
            }
        });

        // Live performance reporting
        perf.setUICallback(report => {
            webviewPanelManager.sendMessage({
                type: 'perfUpdate',
                data: { report }
            });
        });

        progress.report({ increment: 50, message: 'Loading codebase visualizer...' });

        // ───── Load codebase visualizer ─────
        const tVisualizer = perf.start('loadCodebaseVisualizer');
        await extensionLoader.loadCodebaseVisualizer(panel, targetPath);
        perf.stop('loadCodebaseVisualizer', tVisualizer);

        progress.report({ increment: 100, message: 'Complete!' });
        perf.report();
    });
}

async function handleOpenAs3DWorld() {
    await handleExploreDependencies();
}

async function handleAddSign(position: { x: number; y: number; z: number }, workspaceRoot: string) {
    const text = await vscode.window.showInputBox({ prompt: 'Enter sign text (short message)' });
    if (!text) return;

    const signsDir = path.join(workspaceRoot, 'signs');
    vscode.workspace.fs.createDirectory(vscode.Uri.file(signsDir));

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

    await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), Buffer.from(content, 'utf-8'));

    webviewPanelManager.sendMessage({
        type: 'addObject',
        data: {
            id: `sign-${timestamp}`,
            type: 'sign',
            filePath,
            position,
            description: text,
            color: 0xFFDD00
        }
    });
}

export function deactivate() {
    console.log('OpenAs3D extension is being deactivated');

    if (webviewPanelManager) webviewPanelManager.dispose();
    if (extensionLoader) extensionLoader.dispose();
}
