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

    // Add commands to context subscriptions for cleanup
    context.subscriptions.push(exploreDependenciesCommand);
    context.subscriptions.push(openAs3DWorldCommand);

    // Show activation notification
    vscode.window.showInformationMessage('OpenAs3D extension activated! Use "Explore Dependencies in 3D" to get started.');
}

async function handleExploreDependencies(uri?: vscode.Uri) {
    // Get the workspace folder
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showWarningMessage('Please open a workspace folder to explore dependencies.');
        return;
    }

    // Determine the target path
    const targetPath = uri?.fsPath || workspaceFolder.uri.fsPath;
    
    // Show progress notification
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "Analyzing codebase dependencies...",
        cancellable: false
    }, async (progress) => {
        progress.report({ increment: 0, message: "Scanning files..." });
        
        // Create or show the webview panel
        const panel = await webviewPanelManager.createOrShowPanel();
        
        progress.report({ increment: 50, message: "Initializing 3D world..." });
        
        // Load the codebase visualizer
        await extensionLoader.loadCodebaseVisualizer(panel, targetPath);
        
        progress.report({ increment: 100, message: "Complete!" });
    });
}

async function handleOpenAs3DWorld() {
    // For now, this is the same as explore dependencies
    // In the future, this could show a visualizer selection dialog
    await handleExploreDependencies();
}

export function deactivate() {
    console.log('OpenAs3D extension is being deactivated');
    
    // Cleanup resources
    if (webviewPanelManager) {
        webviewPanelManager.dispose();
    }
    
    if (extensionLoader) {
        extensionLoader.dispose();
    }
}