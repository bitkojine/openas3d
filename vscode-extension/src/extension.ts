// extension.ts
import * as vscode from 'vscode';
import { WebviewPanelManager } from './webview/panel';
import { ExtensionLoader } from './visualizers/loader';
import { PerfTracker } from './utils/perf-tracker';
import { ExploreDependenciesService } from './services/explore-dependencies-service';
import { SignService } from './services/sign-service';

let webviewPanelManager: WebviewPanelManager;
let extensionLoader: ExtensionLoader;
let perf: PerfTracker;

let exploreService: ExploreDependenciesService;
let signService: SignService;

export function activate(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension('openas3d.openas3d-vscode');
    const version = extension?.packageJSON?.version || '0.0.0';
    console.log(`OpenAs3D extension is now active! (Build ${version})`);

    // Initialize core managers
    webviewPanelManager = new WebviewPanelManager(context, version);
    extensionLoader = new ExtensionLoader(context);
    perf = new PerfTracker();

    // Initialize services
    exploreService = new ExploreDependenciesService(
        webviewPanelManager,
        extensionLoader,
        perf
    );
    signService = new SignService(webviewPanelManager);

    // Register commands
    const exploreDependenciesCommand = vscode.commands.registerCommand(
        'openas3d.exploreDependencies',
        async (uri?: vscode.Uri) => {
            try {
                await exploreService.exploreDependencies(uri);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to explore dependencies: ${error}`);
            }
        }
    );

    const openAs3DWorldCommand = vscode.commands.registerCommand(
        'openas3d.openAs3DWorld',
        async () => {
            try {
                await exploreService.open3DWorld();
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

export function deactivate() {
    console.log('OpenAs3D extension is being deactivated');

    if (webviewPanelManager) webviewPanelManager.dispose();
    if (extensionLoader) extensionLoader.dispose();
}
