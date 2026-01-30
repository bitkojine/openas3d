import * as vscode from 'vscode';
import { WebviewPanelManager } from '../webview/panel';
import { TestDiscoveryService } from './test-discovery-service';
import { TestDTO } from '../shared/types';
import { LifecycleCoordinator, EventType } from '../core/lifecycle-coordinator';
import { DevManagerV2 } from './dev-manager-v2';
import { ExtensionMessage } from '../shared/messages';

/**
 * TestManager - Handles test-related commands and service wiring for the extension host.
 * 
 * Separates TDD and integration testing logic from the main extension entry point.
 */
export class TestManager {
    constructor(
        private context: vscode.ExtensionContext,
        private testDiscovery: TestDiscoveryService,
        private webviewPanelManager: WebviewPanelManager,
        private coordinator?: LifecycleCoordinator,
        private devManager?: DevManagerV2
    ) { }

    /**
     * Initialize test-related functionality
     */
    public initialize(): void {
        this.registerTDDCommands();
        this.wireTestDiscovery();

        // Register integration test commands only in Test mode
        if (this.context.extensionMode === vscode.ExtensionMode.Test) {
            this.registerIntegrationTestCommands();
        }
    }

    /**
     * Register TDD-related commands
     */
    private registerTDDCommands(): void {
        this.context.subscriptions.push(
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
    }

    /**
     * Wire up Test Discovery events to the Webview
     */
    private wireTestDiscovery(): void {
        this.context.subscriptions.push(
            this.testDiscovery.onDidChangeTests(() => {
                const testsMap = this.testDiscovery.getTests();
                const allTests: TestDTO[] = [];
                testsMap.forEach((tests) => allTests.push(...tests));

                this.webviewPanelManager.dispatchMessage({
                    type: 'updateTests',
                    data: allTests
                });
            })
        );
    }

    /**
     * Register commands used for automated integration testing
     */
    private registerIntegrationTestCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('openas3d.test.e2eStatus', async (data: { phase: 'run' | 'pass' | 'fail' | 'info'; title: string; message?: string }) => {
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'e2eStatus', data } as ExtensionMessage);
                return true;
            }),

            vscode.commands.registerCommand('openas3d.test.getSceneState', async () => {
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'TEST_GET_SCENE_STATE' as any, data: { player: { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, flightMode: false }, ui: { legendOpen: false, tddOpen: false, statsOpen: false }, selection: { selectedFileId: null } } });
                return this.waitForWebviewResponse('TEST_SCENE_STATE', 'Timeout waiting for scene state', 15000);
            }),

            vscode.commands.registerCommand('openas3d.test.sendMessage', async (message: any) => {
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'TEST_MESSAGE' as any, data: message });
                return this.waitForWebviewResponse('TEST_MESSAGE_ACK', 'Timeout waiting for message ack');
            }),

            vscode.commands.registerCommand('openas3d.test.ping', async () => {
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'TEST_PING' as any, data: { player: { position: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0, flightMode: false }, ui: { legendOpen: false, tddOpen: false, statsOpen: false }, selection: { selectedFileId: null } } });
                return this.waitForWebviewResponse('TEST_PONG', 'Timeout waiting for pong');
            }),

            vscode.commands.registerCommand('openas3d.test.saveState', async () => {
                // Trigger state saving through the coordinator
                if (this.coordinator) {
                    await this.coordinator.emitEvent(EventType.STATE_SAVING);
                }
                return true;
            }),

            vscode.commands.registerCommand('openas3d.test.loadState', async () => {
                // Trigger state loading through the coordinator
                if (this.coordinator) {
                    await this.coordinator.emitEvent(EventType.STATE_LOADING);
                }
                return true;
            }),

            vscode.commands.registerCommand('openas3d.test.getHotReloadStatus', async () => {
                return this.devManager ? true : false;
            }),

            vscode.commands.registerCommand('openas3d.test.sendError', async (error: any) => {
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'TEST_ERROR' as any, data: error });
                return this.waitForWebviewResponse('TEST_ERROR_ACK', 'Timeout waiting for error ack', 15000);
            }),

            vscode.commands.registerCommand('openas3d.test.moveObject', async (data: { id: string; position: any }) => {
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'TEST_MOVE_OBJECT' as any, data });
                return this.waitForWebviewResponse('TEST_MOVE_OBJECT_ACK', 'Timeout waiting for move ack');
            }),

            vscode.commands.registerCommand('openas3d.test.simulateSelection', async (id: string) => {
                if (!id) throw new Error('Selection ID is required');
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'TEST_SIMULATE_SELECTION', data: { id } });
                return this.waitForWebviewResponse('TEST_SELECTION_DONE', 'Timeout waiting for selection ack');
            }),

            vscode.commands.registerCommand('openas3d.test.simulateMove', async (x: number, z: number) => {
                console.log('[TestManager] simulateMove called with', x, z);
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'TEST_SIMULATE_MOVE', data: { x, z } });
                return this.waitForWebviewResponse('TEST_MOVE_DONE', 'Timeout waiting for move ack');
            }),

            vscode.commands.registerCommand('openas3d.test.simulateInput', async (kind: string, code?: string) => {
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'TEST_SIMULATE_INPUT', data: { kind, code } });
                return this.waitForWebviewResponse('TEST_INPUT_DONE', 'Timeout waiting for input ack');
            }),

            vscode.commands.registerCommand('openas3d.test.teleport', async (x: number, y: number, z: number) => {
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'TEST_TELEPORT', data: { x, y, z } });
                return this.waitForWebviewResponse('TEST_TELEPORT_DONE', 'Timeout waiting for teleport ack');
            }),

            vscode.commands.registerCommand('openas3d.test.lookAt', async (x: number, y: number, z: number, duration?: number) => {
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'TEST_LOOK_AT', data: { x, y, z, duration } });
                const waitTime = duration ? duration + 2000 : 5000;
                return this.waitForWebviewResponse('TEST_LOOK_AT_DONE', 'Timeout waiting for lookAt ack', waitTime);
            }),

            vscode.commands.registerCommand('openas3d.test.getPosition', async () => {
                await this.webviewPanelManager.ensureReady();
                this.webviewPanelManager.dispatchMessage({ type: 'TEST_GET_POSITION' });
                return this.waitForWebviewResponse('TEST_POSITION', 'Timeout waiting for position');
            })
        );
    }

    /**
     * Helper to wait for a response from the webview with a timeout
     */
    private async waitForWebviewResponse(type: string, timeoutMessage: string, timeoutMs: number = 5000): Promise<any> {
        const timeout = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
        );

        const response = this.webviewPanelManager.waitForMessage(type);
        return Promise.race([response, timeout]);
    }
}
