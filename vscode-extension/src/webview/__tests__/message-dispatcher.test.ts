/**
 * Tests for MessageDispatcher
 * 
 * Verifies that the dispatcher correctly:
 * - Sends messages to webview panel
 * - Waits for messages from webview
 * - Manages ready state
 * - Notifies waiters when messages arrive
 */

import { MessageDispatcher } from '../message-dispatcher';
import { ExtensionMessage } from '../../shared/messages';
import * as vscode from 'vscode';

// Mock vscode module
jest.mock('vscode', () => ({
    window: {
        createWebviewPanel: jest.fn()
    }
}));

describe('MessageDispatcher', () => {
    let dispatcher: MessageDispatcher;
    let mockPanel: any;

    beforeEach(() => {
        mockPanel = {
            webview: {
                postMessage: jest.fn()
            }
        };

        dispatcher = new MessageDispatcher(() => mockPanel);
    });

    describe('message sending', () => {
        it('should send message to panel webview', () => {
            const message: ExtensionMessage = { type: 'clear' };
            dispatcher.sendMessage(message);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(message);
        });

        it('should handle dispatchMessage alias', () => {
            const message: ExtensionMessage = { type: 'clear' };
            dispatcher.dispatchMessage(message);

            expect(mockPanel.webview.postMessage).toHaveBeenCalledWith(message);
        });

        it('should not throw when panel is undefined', () => {
            const dispatcherWithoutPanel = new MessageDispatcher(() => undefined);
            const message: ExtensionMessage = { type: 'clear' };

            expect(() => {
                dispatcherWithoutPanel.sendMessage(message);
            }).not.toThrow();
        });
    });

    describe('message waiting', () => {
        it('should resolve waiter when message is received', async () => {
            const promise = dispatcher.waitForMessage('ready');
            
            // Simulate message arrival
            dispatcher.notifyMessageReceived('ready', { some: 'data' });

            const result = await promise;
            expect(result).toEqual({ some: 'data' });
        });

        it('should resolve with undefined when message has no data', async () => {
            const promise = dispatcher.waitForMessage('ready');
            
            dispatcher.notifyMessageReceived('ready');

            const result = await promise;
            expect(result).toBeUndefined();
        });

        it('should handle multiple waiters for different message types', async () => {
            const promise1 = dispatcher.waitForMessage('ready');
            const promise2 = dispatcher.waitForMessage('error');

            dispatcher.notifyMessageReceived('ready', { ready: true });
            dispatcher.notifyMessageReceived('error', { message: 'test' });

            const result1 = await promise1;
            const result2 = await promise2;

            expect(result1).toEqual({ ready: true });
            expect(result2).toEqual({ message: 'test' });
        });

        it('should remove waiter after resolving', async () => {
            const promise = dispatcher.waitForMessage('ready');
            dispatcher.notifyMessageReceived('ready');
            await promise;

            // Second notification should not resolve anything
            const secondPromise = dispatcher.waitForMessage('ready');
            // This should not resolve immediately
            expect(secondPromise).toBeDefined();
        });
    });

    describe('ready state management', () => {
        it('should start as not ready', () => {
            expect(dispatcher.getReady()).toBe(false);
        });

        it('should set ready when ready message is received', () => {
            dispatcher.notifyMessageReceived('ready');
            expect(dispatcher.getReady()).toBe(true);
        });

        it('should reset ready state', () => {
            dispatcher.notifyMessageReceived('ready');
            expect(dispatcher.getReady()).toBe(true);

            dispatcher.resetReady();
            expect(dispatcher.getReady()).toBe(false);
        });

        it('should wait for ready message', async () => {
            const promise = dispatcher.ensureReady();

            // Should not resolve immediately
            let resolved = false;
            promise.then(() => { resolved = true; });

            // Wait a bit to ensure it doesn't resolve
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(resolved).toBe(false);

            // Now send ready message
            dispatcher.notifyMessageReceived('ready');

            await promise;
            expect(dispatcher.getReady()).toBe(true);
        });

        it('should resolve immediately if already ready', async () => {
            dispatcher.notifyMessageReceived('ready');
            
            const promise = dispatcher.ensureReady();
            await promise; // Should resolve immediately

            expect(dispatcher.getReady()).toBe(true);
        });
    });
});
