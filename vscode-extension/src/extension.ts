import * as vscode from 'vscode';
import { WebviewPanelManager } from './webview/panel';
import { ExtensionLoader } from './visualizers/loader';

let webviewPanelManager: WebviewPanelManager;
let extensionLoader: ExtensionLoader;

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

        const panel = await webviewPanelManager.createOrShowPanel();

        // Hook into webview messages after panel creation
        panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'addSignAtPosition') {
                const text = await vscode.window.showInputBox({ prompt: 'Enter sign text (short message)' });
                if (!text) return;

                webviewPanelManager.sendMessage({
                    type: 'addObject',
                    data: {
                        id: `sign-${Date.now()}`,
                        type: 'sign',
                        filePath: `signs/${Date.now()}.md`,
                        position: message.data.position,
                        description: text,
                        color: 0xFFDD00
                    }
                });
            }
        });

        progress.report({ increment: 50, message: "Initializing 3D world..." });

        await extensionLoader.loadCodebaseVisualizer(panel, targetPath);

        progress.report({ increment: 100, message: "Complete!" });
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
