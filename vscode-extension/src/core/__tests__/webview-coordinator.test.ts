/**
 * Tests for WebviewCoordinator - Coordinated webview lifecycle management
 */

import * as vscode from 'vscode';
import { ExtensionMessage } from '../../shared/messages';

// Mock VSCode before importing the module under test
jest.mock('vscode', () => ({
    window: {
        createWebviewPanel: jest.fn(),
        registerWebviewPanelSerializer: jest.fn()
    },
    ViewColumn: {
        One: 1,
        Two: 2,
        Three: 3
    }
}));

// Import after mocking
import { WebviewCoordinator } from '../webview-coordinator';
import { LifecycleCoordinator, EventType } from '../lifecycle-coordinator';

// Helper to create mock webview panel
function createMockWebviewPanel(viewType: string): any {
    return {
        viewType,
        title: 'Test Panel',
        options: {},
        viewColumn: vscode.ViewColumn.One,
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
}

// Helper to create mock message
function createMockMessage(type: string, data?: any): ExtensionMessage {
    return {
        type: type as any,
        data: data || {}
    };
}

describe('WebviewCoordinator', () => {
    let coordinator: LifecycleCoordinator;
    let webviewCoordinator: WebviewCoordinator;

    beforeEach(() => {
        coordinator = new LifecycleCoordinator();
        webviewCoordinator = new WebviewCoordinator(coordinator);
        jest.clearAllMocks();
    });

    afterEach(() => {
        coordinator.removeAllListeners();
    });

    describe('Webview Creation', () => {
        it('should create webview with proper coordination', async () => {
            const mockPanel = createMockWebviewPanel('test.panel');
            (vscode.window.createWebviewPanel as jest.Mock).mockReturnValue(mockPanel);

            const panel = await webviewCoordinator.createWebview(
                'test.panel',
                'Test Panel',
                vscode.ViewColumn.One
            );

            expect(panel).toBe(mockPanel);
            expect(vscode.window.createWebviewPanel).toHaveBeenCalledWith(
                'test.panel',
                'Test Panel',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
        });

        it('should register existing webview', async () => {
            const mockPanel = createMockWebviewPanel('existing.panel');

            await webviewCoordinator.registerWebview(mockPanel);

            // Should not throw and should set up listeners
            expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalled();
            expect(mockPanel.onDidDispose).toHaveBeenCalled();
            expect(mockPanel.onDidChangeViewState).toHaveBeenCalled();
        });

        it('should not register duplicate webview', async () => {
            const mockPanel = createMockWebviewPanel('duplicate.panel');

            await webviewCoordinator.registerWebview(mockPanel);
            await webviewCoordinator.registerWebview(mockPanel);

            // Should only register once
            expect(mockPanel.webview.onDidReceiveMessage).toHaveBeenCalledTimes(1);
        });
    });

    describe('Message Sending', () => {
        it('should send message immediately when webview is ready', async () => {
            const mockPanel = createMockWebviewPanel('ready.panel');

            await webviewCoordinator.registerWebview(mockPanel);

            // Mark webview as ready
            const webviewState = (webviewCoordinator as any).webviews.get('ready.panel');
            webviewState.isReady = true;

            const message = createMockMessage('test', 'test data');
            await webviewCoordinator.sendMessage('ready.panel', message);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(message);
        });

        it('should queue message when webview is not ready', async () => {
            const mockPanel = createMockWebviewPanel('notready.panel');

            await webviewCoordinator.registerWebview(mockPanel);

            const message = createMockMessage('test', 'test data');
            await webviewCoordinator.sendMessage('notready.panel', message);

            // Should not post message immediately
            expect(mockPanel.webview.postMessage).not.toHaveBeenCalled();

            // Simulate webview becoming ready by sending a 'ready' message
            const messageCallback = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
            messageCallback({ type: 'ready' });

            // Wait for the queued message to be processed
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(message);
        });

        it('should broadcast message to all webviews', async () => {
            const mockPanel1 = createMockWebviewPanel('panel1');
            const mockPanel2 = createMockWebviewPanel('panel2');

            await webviewCoordinator.registerWebview(mockPanel1);
            await webviewCoordinator.registerWebview(mockPanel2);

            // Mark both as ready
            const webviewState1 = (webviewCoordinator as any).webviews.get('panel1');
            const webviewState2 = (webviewCoordinator as any).webviews.get('panel2');
            webviewState1.isReady = true;
            webviewState2.isReady = true;

            const message = createMockMessage('broadcast', 'broadcast data');
            await webviewCoordinator.broadcastMessage(message);

            expect(mockPanel1.webview.postMessage).toHaveBeenCalledWith(message);
            expect(mockPanel2.webview.postMessage).toHaveBeenCalledWith(message);
        });
    });

    describe('Webview Lifecycle', () => {
        it('should handle webview disposal', async () => {
            const mockPanel = createMockWebviewPanel('disposable.panel');

            await webviewCoordinator.registerWebview(mockPanel);

            // Simulate disposal
            const disposeCallback = mockPanel.onDidDispose.mock.calls[0][0];
            disposeCallback();

            // Webview should be removed from coordinator
            expect((webviewCoordinator as any).webviews.has('disposable.panel')).toBe(false);
        });

        it('should handle webview ready event', async () => {
            const mockPanel = createMockWebviewPanel('readyevent.panel');

            await webviewCoordinator.registerWebview(mockPanel);

            // Simulate ready message
            const messageCallback = mockPanel.webview.onDidReceiveMessage.mock.calls[0][0];
            messageCallback({ type: 'ready' });

            // Webview should be marked as ready
            const webviewState = (webviewCoordinator as any).webviews.get('readyevent.panel');
            expect(webviewState.isReady).toBe(true);
        });
    });

    describe('Error Handling', () => {
        it('should handle send to non-existent webview gracefully', async () => {
            const message = createMockMessage('test', 'test data');
            
            // Should not throw
            await expect(webviewCoordinator.sendMessage('nonexistent.panel', message))
                .resolves.toBeUndefined();
        });

        it('should handle message sending errors gracefully', async () => {
            const mockPanel = createMockWebviewPanel('error.panel');

            await webviewCoordinator.registerWebview(mockPanel);

            // Mark as ready
            const webviewState = (webviewCoordinator as any).webviews.get('error.panel');
            webviewState.isReady = true;

            mockPanel.webview.postMessage.mockImplementation(() => {
                throw new Error('Send failed');
            });

            const message = createMockMessage('test', 'test data');
            
            // Should not throw
            await expect(webviewCoordinator.sendMessage('error.panel', message))
                .resolves.toBeUndefined();
        });
    });
});
