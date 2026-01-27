/**
 * Tests for WebviewMessageHandler
 * 
 * Verifies that the handler correctly:
 * - Routes messages to registered handlers
 * - Notifies dispatcher when messages arrive
 * - Handles errors gracefully
 * - Skips test messages after notifying dispatcher
 */

import { WebviewMessageHandler } from '../webview-message-handler';
import { WebviewMessage } from '../../shared/messages';
import * as vscode from 'vscode';

// Mock vscode module
jest.mock('vscode', () => ({
    window: {
        showErrorMessage: jest.fn()
    }
}));

describe('WebviewMessageHandler', () => {
    let handler: WebviewMessageHandler;
    let mockDispatcher: { notifyMessageReceived: jest.Mock };

    beforeEach(() => {
        mockDispatcher = {
            notifyMessageReceived: jest.fn()
        };
        handler = new WebviewMessageHandler(mockDispatcher);
    });

    describe('message routing', () => {
        it('should call registered handler', async () => {
            let called = false;
            handler.register('objectSelected', () => {
                called = true;
            });

            const message: WebviewMessage = {
                type: 'objectSelected',
                data: { id: 'test-id', type: 'file', filePath: '/test.ts' }
            };

            await handler.handle(message);

            expect(called).toBe(true);
        });

        it('should pass data to handler', async () => {
            let receivedData: any = null;
            handler.register('objectSelected', (data) => {
                receivedData = data;
            });

            const message: WebviewMessage = {
                type: 'objectSelected',
                data: { id: 'test-id', type: 'file', filePath: '/test.ts' }
            };

            await handler.handle(message);

            expect(receivedData).toEqual({ id: 'test-id', type: 'file', filePath: '/test.ts' });
        });

        it('should handle messages without data', async () => {
            let called = false;
            handler.register('ready', () => {
                called = true;
            });

            const message: WebviewMessage = { type: 'ready' };

            await handler.handle(message);

            expect(called).toBe(true);
        });

        it('should handle async handlers', async () => {
            let resolved = false;
            handler.register('ready', async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                resolved = true;
            });

            const message: WebviewMessage = { type: 'ready' };
            await handler.handle(message);

            expect(resolved).toBe(true);
        });
    });

    describe('dispatcher notification', () => {
        it('should notify dispatcher before calling handler', async () => {
            let handlerCalled = false;
            handler.register('ready', () => {
                handlerCalled = true;
            });

            const message: WebviewMessage = { type: 'ready' };
            await handler.handle(message);

            expect(mockDispatcher.notifyMessageReceived).toHaveBeenCalledWith('ready', undefined);
            expect(handlerCalled).toBe(true);
        });

        it('should notify dispatcher with data', async () => {
            handler.register('error', () => { });

            const message: WebviewMessage = {
                type: 'error',
                data: { message: 'test error' }
            };

            await handler.handle(message);

            expect(mockDispatcher.notifyMessageReceived).toHaveBeenCalledWith('error', { message: 'test error' });
        });
    });

    describe('test messages', () => {
        it('should notify dispatcher but skip handler for test messages', async () => {
            let handlerCalled = false;
            handler.register('TEST_SELECTION_DONE', () => {
                handlerCalled = true;
            });

            const message: WebviewMessage = { type: 'TEST_SELECTION_DONE' };
            await handler.handle(message);

            expect(mockDispatcher.notifyMessageReceived).toHaveBeenCalledWith('TEST_SELECTION_DONE', undefined);
            expect(handlerCalled).toBe(false);
        });
    });

    describe('error handling', () => {
        it('should catch and log handler errors', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            const error = new Error('Test error');

            handler.register('error', () => {
                throw error;
            });

            const message: WebviewMessage = {
                type: 'error',
                data: { message: 'test' }
            };

            await handler.handle(message);

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[WebviewMessageHandler] Error handling error:',
                error
            );
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Error handling webview message: Test error'
            );

            consoleErrorSpy.mockRestore();
        });

        it('should handle non-Error exceptions', async () => {
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

            handler.register('error', () => {
                throw 'String error';
            });

            const message: WebviewMessage = {
                type: 'error',
                data: { message: 'test' }
            };

            await handler.handle(message);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                'Error handling webview message: String error'
            );

            consoleErrorSpy.mockRestore();
        });
    });

    describe('unknown messages', () => {
        it('should log unknown message types', async () => {
            const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

            const message: WebviewMessage = { type: 'unknownMessage' as any };
            await handler.handle(message);

            expect(consoleLogSpy).toHaveBeenCalledWith('Unknown message from webview:', 'unknownMessage');
            expect(mockDispatcher.notifyMessageReceived).toHaveBeenCalledWith('unknownMessage', undefined);

            consoleLogSpy.mockRestore();
        });
    });

    describe('default handlers', () => {
        it('should have default handler for ready', async () => {
            const message: WebviewMessage = { type: 'ready' };

            // Should not throw
            await expect(handler.handle(message)).resolves.not.toThrow();
        });

        it('should have default handler for error', async () => {
            const message: WebviewMessage = {
                type: 'error',
                data: { message: 'test' }
            };

            await handler.handle(message);

            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('3D World Error: test');
        });

        it('should have default handler for log', async () => {
            const message: WebviewMessage = {
                type: 'log',
                data: { level: 1, message: 'test log' }
            };

            // Should not throw (handler is no-op)
            await expect(handler.handle(message)).resolves.not.toThrow();
        });

        it('should have default handler for objectFocused', async () => {
            const message: WebviewMessage = {
                type: 'objectFocused',
                data: { id: 'test', type: 'file', filePath: '/test.ts' }
            };

            // Should not throw (handler is no-op)
            await expect(handler.handle(message)).resolves.not.toThrow();
        });
    });
    describe('middleware', () => {
        it('should execute middleware before handler', async () => {
            const operations: string[] = [];

            handler.use(async (msg, next) => {
                operations.push('middleware-start');
                await next();
                operations.push('middleware-end');
            });

            handler.register('ready', () => {
                operations.push('handler');
            });

            await handler.handle({ type: 'ready' });

            expect(operations).toEqual(['middleware-start', 'handler', 'middleware-end']);
        });

        it('should execute multiple middleware in order', async () => {
            const operations: string[] = [];

            handler.use(async (msg, next) => {
                operations.push('m1-start');
                await next();
                operations.push('m1-end');
            });

            handler.use(async (msg, next) => {
                operations.push('m2-start');
                await next();
                operations.push('m2-end');
            });

            handler.register('ready', () => {
                operations.push('handler');
            });

            await handler.handle({ type: 'ready' });

            expect(operations).toEqual([
                'm1-start',
                'm2-start',
                'handler',
                'm2-end',
                'm1-end'
            ]);
        });
    });
});
