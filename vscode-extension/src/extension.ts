// extension.ts
import * as vscode from 'vscode';
import { WebviewPanelManager } from './webview/panel';
import { CodebaseVisualizer } from './visualizers/codebase'; // Explicit import
import { PerfTracker } from './utils/perf-tracker';
import { ExploreDependenciesService } from './services/explore-dependencies-service';
import { SignService } from './services/sign-service';

import { LayoutPersistenceService } from './services/layout-persistence';
import { TestDiscoveryService } from './services/test-discovery-service';
import { TestManager } from './services/test-manager';
import { DevManagerV2 } from './services/dev-manager-v2';
import { AnalysisCacheService } from './services/analysis-cache';

// New architecture imports
import { LifecycleCoordinator } from './core/lifecycle-coordinator';
import { StateManager } from './core/state-manager';
import { WebviewCoordinator } from './core/webview-coordinator';
import { ErrorRecoverySystem } from './core/error-recovery';

let webviewPanelManager: WebviewPanelManager;
let perf: PerfTracker;

let exploreService: ExploreDependenciesService;
let signService: SignService;
let layoutPersistence: LayoutPersistenceService;
let testDiscovery: TestDiscoveryService;
let testManager: TestManager;
let devManager: DevManagerV2;
let analysisCache: AnalysisCacheService;

// New architecture components
let coordinator: LifecycleCoordinator;
let stateManager: StateManager;
let webviewCoordinator: WebviewCoordinator;
let errorRecovery: ErrorRecoverySystem;

export function activate(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension('openas3d.openas3d-vscode');
    const version = extension?.packageJSON?.version || '0.0.0';
    console.log(`OpenAs3D extension is now active! (Version ${version})`);

    // Initialize new architecture components first
    coordinator = new LifecycleCoordinator();
    stateManager = new StateManager(context, coordinator);
    webviewCoordinator = new WebviewCoordinator(coordinator);
    errorRecovery = new ErrorRecoverySystem(coordinator);

    // Initialize core managers
    // We pass perf tracker to WebviewPanelManager for middleware support
    perf = new PerfTracker();
    PerfTracker.instance = perf; // Set singleton for decorators
    webviewPanelManager = new WebviewPanelManager(context, perf, version, coordinator);

    // Initialize Backend Services
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    console.log('[Extension] Workspace root:', workspaceRoot);
    layoutPersistence = new LayoutPersistenceService(workspaceRoot);
    testDiscovery = new TestDiscoveryService();

    // Initialize Dev Manager V2 (new race-free implementation)
    devManager = new DevManagerV2(context, coordinator, stateManager);
    devManager.initialize();

    // Initialize Test Manager
    testManager = new TestManager(context, testDiscovery, webviewPanelManager, coordinator, devManager);
    testManager.initialize();

    // Initialize Analysis Cache
    analysisCache = new AnalysisCacheService(context);

    // Inject persistence into Visualizer -> LayoutEngine
    const codebaseVisualizer = new CodebaseVisualizer(context.extensionPath, layoutPersistence, analysisCache);

    // Initialize services
    signService = new SignService(webviewPanelManager);
    exploreService = new ExploreDependenciesService(
        webviewPanelManager,
        codebaseVisualizer,
        perf,
        signService, // inject SignService here
        context,
        stateManager // inject StateManager for race-free state persistence
    );

    // Register Move Handler for persistence
    webviewPanelManager.registerMoveHandler(async (id, pos) => {
        console.log('[Extension] Move handler called:', { id, pos });
        // The id is now the fileId directly from the webview
        await layoutPersistence.savePosition(id, pos.x, pos.z);
        console.log('[Extension] Layout persistence completed');
    });

    // Register Webview Serializer for restoration across reloads
    vscode.window.registerWebviewPanelSerializer('openas3d-world', webviewPanelManager);

    // Register commands
    const exploreDependenciesCommand = vscode.commands.registerCommand(
        'openas3d.exploreDependencies',
        async (uri?: vscode.Uri) => {
            try {
                // Update workspace root if it changed (e.g. multi-root or first load)
                if (uri) {
                    // logic to determine root from uri? For now keep simple
                }
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

    // Start performance update loop (every 2 seconds)
    const perfInterval = setInterval(() => {
        if (webviewPanelManager && webviewPanelManager.hasPanel()) {
            const stats = perf.getStats().slice(0, 5); // Top 5
            webviewPanelManager.dispatchMessage({
                type: 'perfStats',
                data: stats
            });
        }
    }, 2000);

    context.subscriptions.push(
        { dispose: () => clearInterval(perfInterval) },
        { dispose: () => testDiscovery.dispose() }
    );

    // Restore 3D World if it was open before reload
    // Add delay to ensure workbench is stable
    setTimeout(() => {
        exploreService.restore();
    }, 3000);
}

export function deactivate() {
    console.log('OpenAs3D extension is being deactivated');

    if (webviewPanelManager) { webviewPanelManager.dispose(); }
    // CodebaseVisualizer doesn't have a dispose method currently, cleanup happens via initialize return fn
}
