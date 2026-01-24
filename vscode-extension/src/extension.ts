// extension.ts
import * as vscode from 'vscode';
import { WebviewPanelManager } from './webview/panel';
import { CodebaseVisualizer } from './visualizers/codebase'; // Explicit import
import { PerfTracker } from './utils/perf-tracker';
import { ExploreDependenciesService } from './services/explore-dependencies-service';
import { SignService } from './services/sign-service';

import { LayoutPersistenceService } from './services/layout-persistence';
import { TestDiscoveryService } from './services/test-discovery-service';

let webviewPanelManager: WebviewPanelManager;
let perf: PerfTracker;

let exploreService: ExploreDependenciesService;
let signService: SignService;
let layoutPersistence: LayoutPersistenceService;
let testDiscovery: TestDiscoveryService;

export function activate(context: vscode.ExtensionContext) {
    const extension = vscode.extensions.getExtension('openas3d.openas3d-vscode');
    const version = extension?.packageJSON?.version || '0.0.0';
    console.log(`OpenAs3D extension is now active! (Build ${version})`);

    // Initialize core managers
    // We pass perf tracker to WebviewPanelManager for middleware support
    perf = new PerfTracker();
    PerfTracker.instance = perf; // Set singleton for decorators
    webviewPanelManager = new WebviewPanelManager(context, perf, version);

    // Initialize Backend Services
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    layoutPersistence = new LayoutPersistenceService(workspaceRoot);
    testDiscovery = new TestDiscoveryService();

    // Inject persistence into Visualizer -> LayoutEngine
    const codebaseVisualizer = new CodebaseVisualizer(context.extensionPath, layoutPersistence);

    // Initialize services
    signService = new SignService(webviewPanelManager);
    exploreService = new ExploreDependenciesService(
        webviewPanelManager,
        codebaseVisualizer,
        perf,
        signService // inject SignService here
    );

    // Register TDD Commands
    context.subscriptions.push(
        vscode.commands.registerCommand('openas3d.tdd.runAll', () => {
            vscode.commands.executeCommand('testing.runAll');
        }),
        vscode.commands.registerCommand('openas3d.tdd.runFailed', () => {
            vscode.commands.executeCommand('testing.runFailed');
        }),
        vscode.commands.registerCommand('openas3d.tdd.toggleWatch', () => {
            // Toggle watch mode logic (future)
            vscode.window.showInformationMessage('TDD Watch Mode toggled (Simulated)');
        })
    );

    // Wire up Test Discovery to Webview
    testDiscovery.onDidChangeTests(() => {
        const testsMap = testDiscovery.getTests();
        const allTests: any[] = [];
        testsMap.forEach((tests) => allTests.push(...tests));

        webviewPanelManager.dispatchMessage({
            type: 'updateTests',
            data: allTests
        });
    });

    // Register Move Handler for persistence
    webviewPanelManager.registerMoveHandler(async (id, pos) => {
        await layoutPersistence.savePosition(id, pos.x, pos.z);
    });

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

    // Register test commands only in Test mode
    if (context.extensionMode === vscode.ExtensionMode.Test) {
        const testGetSceneStateCommand = vscode.commands.registerCommand(
            'openas3d.test.getSceneState',
            async () => {
                if (!webviewPanelManager) {
                    throw new Error('WebviewPanelManager not initialized');
                }
                // Send request
                webviewPanelManager.dispatchMessage({ type: 'TEST_GET_SCENE_STATE' });

                // Wait for response with 5s timeout
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for scene state')), 5000));
                const response = webviewPanelManager.waitForMessage('TEST_SCENE_STATE');
                return Promise.race([response, timeout]);
            }
        );

        const testSimulateSelectionCommand = vscode.commands.registerCommand(
            'openas3d.test.simulateSelection',
            async (id: string) => {
                if (!webviewPanelManager) {
                    throw new Error('WebviewPanelManager not initialized');
                }
                webviewPanelManager.dispatchMessage({ type: 'TEST_SIMULATE_SELECTION', data: { id } });
                // Wait for ack
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for selection ack')), 5000));
                const response = webviewPanelManager.waitForMessage('TEST_SELECTION_DONE');
                return Promise.race([response, timeout]);
            }
        );

        const testSimulateMoveCommand = vscode.commands.registerCommand(
            'openas3d.test.simulateMove',
            async (x: number, z: number) => {
                if (!webviewPanelManager) {
                    throw new Error('WebviewPanelManager not initialized');
                }
                webviewPanelManager.dispatchMessage({ type: 'TEST_SIMULATE_MOVE', data: { x, z } });
                // Wait for ack
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for move ack')), 5000));
                const response = webviewPanelManager.waitForMessage('TEST_MOVE_DONE');
                return Promise.race([response, timeout]);
            }
        );

        const testSimulateInputCommand = vscode.commands.registerCommand(
            'openas3d.test.simulateInput',
            async (kind: string, code?: string) => {
                if (!webviewPanelManager) {
                    throw new Error('WebviewPanelManager not initialized');
                }
                webviewPanelManager.dispatchMessage({ type: 'TEST_SIMULATE_INPUT', data: { kind, code } });
                const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for input ack')), 5000));
                const response = webviewPanelManager.waitForMessage('TEST_INPUT_DONE');
                return Promise.race([response, timeout]);
            }
        );

        const testTeleportCommand = vscode.commands.registerCommand(
            'openas3d.test.teleport',
            async (x: number, y: number, z: number) => {
                if (!webviewPanelManager) { throw new Error('WebviewPanelManager not initialized'); }
                webviewPanelManager.dispatchMessage({ type: 'TEST_TELEPORT', data: { x, y, z } });
                const response = webviewPanelManager.waitForMessage('TEST_TELEPORT_DONE');
                return Promise.race([response, new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 5000))]);
            }
        );

        const testLookAtCommand = vscode.commands.registerCommand(
            'openas3d.test.lookAt',
            async (x: number, y: number, z: number, duration?: number) => {
                if (!webviewPanelManager) { throw new Error('WebviewPanelManager not initialized'); }
                webviewPanelManager.dispatchMessage({ type: 'TEST_LOOK_AT', data: { x, y, z, duration } });
                const response = webviewPanelManager.waitForMessage('TEST_LOOK_AT_DONE');
                // Increase timeout for animations
                const waitTime = duration ? duration + 2000 : 5000;
                return Promise.race([response, new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), waitTime))]);
            }
        );

        const testGetPositionCommand = vscode.commands.registerCommand(
            'openas3d.test.getPosition',
            async () => {
                if (!webviewPanelManager) { throw new Error('WebviewPanelManager not initialized'); }
                webviewPanelManager.dispatchMessage({ type: 'TEST_GET_POSITION' });
                const response = webviewPanelManager.waitForMessage('TEST_POSITION');
                return Promise.race([response, new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 5000))]);
            }
        );

        context.subscriptions.push(
            testGetSceneStateCommand,
            testSimulateSelectionCommand,
            testSimulateMoveCommand,
            testSimulateInputCommand,
            testTeleportCommand,
            testLookAtCommand,
            testGetPositionCommand
        );
    }

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
}

export function deactivate() {
    console.log('OpenAs3D extension is being deactivated');

    if (webviewPanelManager) { webviewPanelManager.dispose(); }
    // CodebaseVisualizer doesn't have a dispose method currently, cleanup happens via initialize return fn
}
