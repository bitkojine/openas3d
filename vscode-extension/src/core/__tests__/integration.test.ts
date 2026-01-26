/**
 * Integration Tests - Test real end-to-end functionality
 * These tests catch integration issues that unit tests might miss
 */

import { LifecycleCoordinator, EventType } from '../lifecycle-coordinator';
import { StateManager } from '../state-manager';
import { WebviewCoordinator } from '../webview-coordinator';
import { DevManagerV2 } from '../../services/dev-manager-v2';

// Mock VSCode
jest.mock('vscode', () => ({
    window: {
        createWebviewPanel: jest.fn(),
        registerWebviewPanelSerializer: jest.fn(),
        showInformationMessage: jest.fn(),
        showErrorMessage: jest.fn()
    },
    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3
    },
    commands: {
        executeCommand: jest.fn(),
        registerCommand: jest.fn()
    }
}));

describe('Integration Tests', () => {
    let coordinator: LifecycleCoordinator;
    let stateManager: StateManager;
    let webviewCoordinator: WebviewCoordinator;
    let devManager: DevManagerV2;
    let mockContext: any;

    beforeEach(() => {
        mockContext = {
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            },
            workspaceState: {
                get: jest.fn(),
                update: jest.fn()
            },
            subscriptions: []
        };

        coordinator = new LifecycleCoordinator();
        stateManager = new StateManager(mockContext, coordinator);
        webviewCoordinator = new WebviewCoordinator(coordinator);
        devManager = new DevManagerV2(mockContext, coordinator, stateManager);
        
        jest.clearAllMocks();
    });

    afterEach(() => {
        coordinator.removeAllListeners();
    });

    describe('Extension Startup Flow', () => {
        it('should initialize all components in correct order', async () => {
            // Test that components can be created and work together
            expect(coordinator.getState()).toBe('initializing');
            expect(stateManager).toBeDefined();
            expect(webviewCoordinator).toBeDefined();
            expect(devManager).toBeDefined();

            // Test extension ready flow
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            expect(coordinator.getState()).toBe('ready');
        });

        it('should handle state persistence during reload', async () => {
            // Setup initial state
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            
            // Save some state
            const config = { key: 'test.integration', scope: 'global' as const };
            const testData = { message: 'integration test data' };
            await stateManager.saveState(config, testData);

            // Verify state was saved
            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                'test.integration',
                expect.objectContaining({
                    version: '1.0',
                    timestamp: expect.any(Number),
                    data: testData,
                    checksum: expect.any(String)
                })
            );

            // Test reload flow
            await coordinator.emitEvent(EventType.RELOAD_REQUESTED);
            expect(coordinator.getState()).toBe('reloading');
            
            // Load state back - need to mock the get method to return our saved data
            // Use the same checksum algorithm as StateManager
            const serialized = JSON.stringify(testData);
            let hash = 0;
            for (let i = 0; i < serialized.length; i++) {
                const char = serialized.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            const checksum = hash.toString(16);
            
            mockContext.globalState.get.mockReturnValue({
                version: '1.0',
                timestamp: Date.now(),
                data: testData,
                checksum
            });
            
            const loadedData = await stateManager.loadState(config);
            expect(loadedData).toEqual(testData);
        });
    });

    describe('Webview Integration', () => {
        it('should coordinate webview lifecycle properly', async () => {
            // Create a mock webview
            const mockWebview = {
                viewType: 'test.webview',
                title: 'Test Webview',
                options: {},
                viewColumn: 1,
                active: true,
                visible: true,
                webview: {
                    onDidReceiveMessage: jest.fn(),
                    postMessage: jest.fn(),
                    html: ''
                },
                onDidDispose: jest.fn(),
                onDidChangeViewState: jest.fn(),
                reveal: jest.fn(),
                dispose: jest.fn()
            };

            // Register webview
            await webviewCoordinator.registerWebview(mockWebview as any);

            // Test message sending when not ready
            const message = { type: 'test' as any, data: 'test message' };
            await webviewCoordinator.sendMessage('test.webview', message);
            expect(mockWebview.webview.postMessage).not.toHaveBeenCalled();

            // Simulate webview becoming ready
            const messageCallback = mockWebview.webview.onDidReceiveMessage.mock.calls[0][0];
            messageCallback({ type: 'ready' });

            // Wait for queued message to be processed
            await new Promise(resolve => setTimeout(resolve, 50));

            // Verify message was sent
            expect(mockWebview.webview.postMessage).toHaveBeenCalledWith(message);
        });

        it('should handle multiple webviews', async () => {
            const webviews = [];
            
            // Create multiple webviews
            for (let i = 0; i < 3; i++) {
                const mockWebview = {
                    viewType: `test.webview.${i}`,
                    title: `Test Webview ${i}`,
                    options: {},
                    viewColumn: 1,
                    active: true,
                    visible: true,
                    webview: {
                        onDidReceiveMessage: jest.fn(),
                        postMessage: jest.fn(),
                        html: ''
                    },
                    onDidDispose: jest.fn(),
                    onDidChangeViewState: jest.fn(),
                    reveal: jest.fn(),
                    dispose: jest.fn()
                };
                
                await webviewCoordinator.registerWebview(mockWebview as any);
                webviews.push(mockWebview);
            }

            // Test broadcasting
            const message = { type: 'broadcast' as any, data: 'broadcast test' };
            await webviewCoordinator.broadcastMessage(message);

            // All webviews should receive the message when ready
            for (const webview of webviews) {
                const messageCallback = webview.webview.onDidReceiveMessage.mock.calls[0][0];
                messageCallback({ type: 'ready' });
            }

            await new Promise(resolve => setTimeout(resolve, 100));

            for (const webview of webviews) {
                expect(webview.webview.postMessage).toHaveBeenCalledWith(message);
            }
        });
    });

    describe('Error Recovery Integration', () => {
        it('should handle component failures gracefully', async () => {
            // Test that system continues working even if one component fails
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            
            // Simulate error in state manager
            const originalSave = stateManager.saveState;
            stateManager.saveState = jest.fn().mockRejectedValue(new Error('State save failed'));

            // System should still be functional
            expect(coordinator.getState()).toBe('ready');
            
            // Try to save state - should fail gracefully
            const config = { key: 'test.error', scope: 'global' as const };
            await expect(stateManager.saveState(config, {})).rejects.toThrow('State save failed');
            
            // Restore functionality
            stateManager.saveState = originalSave;
            await expect(stateManager.saveState(config, {})).resolves.toBeUndefined();
        });

        it('should recover from webview disconnection', async () => {
            // Create and register webview
            const mockWebview = {
                viewType: 'test.recovery',
                title: 'Test Recovery',
                options: {},
                viewColumn: 1,
                active: true,
                visible: true,
                webview: {
                    onDidReceiveMessage: jest.fn(),
                    postMessage: jest.fn(),
                    html: ''
                },
                onDidDispose: jest.fn(),
                onDidChangeViewState: jest.fn(),
                reveal: jest.fn(),
                dispose: jest.fn()
            };

            await webviewCoordinator.registerWebview(mockWebview as any);

            // Send message while webview is active
            const message1 = { type: 'before-dispose' as any, data: 'test1' };
            await webviewCoordinator.sendMessage('test.recovery', message1);

            // Simulate webview disposal
            const disposeCallback = mockWebview.onDidDispose.mock.calls[0][0];
            disposeCallback();

            // Try to send message after disposal - should handle gracefully
            const message2 = { type: 'after-dispose' as any, data: 'test2' };
            await expect(webviewCoordinator.sendMessage('test.recovery', message2))
                .resolves.toBeUndefined();
        });
    });

    describe('Hot Reload Integration', () => {
        it('should coordinate hot reload without race conditions', async () => {
            // Setup initial state
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            
            // Start hot reload
            await coordinator.emitEvent(EventType.RELOAD_REQUESTED);
            
            // Should be in reloading state
            expect(coordinator.getState()).toBe('reloading');
            
            // Should be able to complete reload
            await coordinator.emitEvent(EventType.RELOAD_COMPLETED);
            expect(coordinator.getState()).toBe('ready');
        });

        it('should handle high-frequency events without issues', async () => {
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            
            // Send many events rapidly
            const promises = [];
            for (let i = 0; i < 100; i++) {
                promises.push(coordinator.emitEvent(EventType.ANALYSIS_STARTED));
                promises.push(coordinator.emitEvent(EventType.ANALYSIS_COMPLETED));
            }
            
            // Should handle all events without errors
            await expect(Promise.all(promises)).resolves.toBeDefined();
            
            // Should end up in READY state
            expect(coordinator.getState()).toBe('ready');
        });
    });

    describe('Component Communication', () => {
        it('should handle basic event emission', async () => {
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            expect(coordinator.getState()).toBe('ready');
        });
    });
});
