import * as vscode from 'vscode';
import { WebviewCoordinator, WebviewState } from '../webview-coordinator';
import { LifecycleCoordinator, EventType } from '../lifecycle-coordinator';
import { ErrorRecoverySystem, ErrorCategory, ErrorSeverity } from '../error-recovery';
import { ExtensionMessage, WebviewMessage } from '../../shared/messages';

jest.mock('vscode', () => ({
    window: {
        createWebviewPanel: jest.fn().mockReturnValue({
            webview: {
                onDidReceiveMessage: jest.fn().mockReturnValue({ dispose: jest.fn() }),
                postMessage: jest.fn().mockResolvedValue(true),
                asWebviewUri: jest.fn(uri => uri),
                cspSource: 'mock-csp'
            },
            onDidDispose: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            onDidChangeViewState: jest.fn().mockReturnValue({ dispose: jest.fn() }),
            reveal: jest.fn(),
            dispose: jest.fn(),
            visible: true
        })
    },
    Uri: {
        file: jest.fn(path => ({ fsPath: path, scheme: 'file' })),
        joinPath: jest.fn((uri, ...parts) => ({ fsPath: parts.join('/'), scheme: 'file' }))
    },
    ViewColumn: {
        One: 1,
        Two: 2
    },
    Disposable: jest.fn()
}), { virtual: true });

// Mock Logger
jest.mock('../logger', () => ({
    Logger: {
        getInstance: jest.fn().mockReturnValue({
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        })
    }
}));

describe('WebviewCoordinator', () => {
    let coordinator: WebviewCoordinator;
    let mockLifecycle: LifecycleCoordinator;
    let mockErrorRecovery: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockLifecycle = new LifecycleCoordinator();
        mockErrorRecovery = {
            reportError: jest.fn().mockResolvedValue(true)
        };

        coordinator = new WebviewCoordinator(mockLifecycle, mockErrorRecovery as any);
        await mockLifecycle.emitEvent(EventType.EXTENSION_READY);
    });

    afterEach(() => {
        coordinator.dispose();
    });

    /**
     * Tests that createWebview correctly initializes a new VS Code webview panel
     * and tracks it in the coordinator's state.
     */
    it('should create and register a webview panel', async () => {
        const panel = await coordinator.createWebview('testView', 'Test View', 1);
        expect(vscode.window.createWebviewPanel).toHaveBeenCalled();
        expect(coordinator.getAllWebviewStates().length).toBe(1);
    });

    /**
     * Tests the IPC bridge from webview to extension.
     * Verifies that messages received by the webview panel are routed to the
     * correct message handlers registered in the coordinator.
     */
    it('should handle messages from webview', async () => {
        const panel = await coordinator.createWebview('testView', 'Test View', 1);
        const states = coordinator.getAllWebviewStates();
        const webviewId = states[0].id;

        const handler = jest.fn();
        coordinator.registerMessageHandler('test_message', handler);

        // Simulate message from webview
        const messageCallback = (panel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
        await messageCallback({ type: 'test_message', data: { foo: 'bar' } });

        expect(handler).toHaveBeenCalledWith({ foo: 'bar' });
    });

    /**
     * Tests the message queuing mechanism.
     * Verifies that messages sent to a webview that hasn't finished loading (not 'ready')
     * are held in a queue and only dispatched after the webview signals it is ready.
     */
    it('should queue messages if webview is not ready', async () => {
        const panel = await coordinator.createWebview('testView', 'Test View', 1);
        const webviewId = coordinator.getAllWebviewStates()[0].id;

        coordinator.sendMessage(webviewId, { type: 'data_update', data: { x: 1 } } as any);

        // Should not have sent message yet
        expect(panel.webview.postMessage).not.toHaveBeenCalled();

        // Simulate ready message
        const messageCallback = (panel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
        await messageCallback({ type: 'ready' });

        // Now it should be sent
        expect(panel.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'data_update' }));
    });

    /**
     * Tests error handling for outgoing IPC messages.
     * Verifies that failures in the underlying VS Code postMessage call are
     * caught and reported to the system's ErrorRecoverySystem.
     */
    it('should report postMessage failures to ErrorRecoverySystem', async () => {
        const panel = await coordinator.createWebview('testView', 'Test View', 1);
        const webviewId = coordinator.getAllWebviewStates()[0].id;

        // Make it ready first
        const messageCallback = (panel.webview.onDidReceiveMessage as jest.Mock).mock.calls[0][0];
        await messageCallback({ type: 'ready' });

        // Fail postMessage
        const error = new Error('IPC Failed');
        (panel.webview.postMessage as jest.Mock).mockRejectedValue(error);

        await coordinator.sendMessage(webviewId, { type: 'ping' } as any);

        expect(mockErrorRecovery.reportError).toHaveBeenCalledWith(
            ErrorCategory.COMMUNICATION,
            ErrorSeverity.HIGH,
            expect.stringContaining('Failed to send message'),
            expect.any(Object)
        );
    });

    /**
     * Tests the cleanup logic.
     * Verifies that disposing the coordinator properly disposes of all managed
     * webview panels and clears its internal state.
     */
    it('should clean up on disposal', async () => {
        const panel = await coordinator.createWebview('testView', 'Test View', 1);
        await coordinator.disposeAllWebviews();

        expect(panel.dispose).toHaveBeenCalled();
        expect(coordinator.getAllWebviewStates().length).toBe(0);
    });
});
