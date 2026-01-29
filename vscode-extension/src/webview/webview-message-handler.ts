/**
 * WebviewMessageHandler - Handles incoming messages from webview
 * 
 * Single Responsibility: Route incoming webview messages to appropriate handlers.
 * Uses a simple handler registry pattern (similar to MessageRouter but for webview messages).
 */

import * as vscode from 'vscode';
import { WebviewMessage, WebviewMessageType, WebviewMessageData } from '../shared/messages';

type MessageHandlerFn<T extends WebviewMessageType> = (
    data: WebviewMessageData<T>
) => void | Promise<void>;

export class WebviewMessageHandler {
    private handlers = new Map<WebviewMessageType, (data: any) => void | Promise<void>>();
    private middleware: ((message: WebviewMessage, next: () => Promise<void>) => Promise<void>)[] = [];
    private messageDispatcher: { notifyMessageReceived(type: string, data?: any): void };

    constructor(messageDispatcher: { notifyMessageReceived(type: string, data?: any): void }) {
        this.messageDispatcher = messageDispatcher;
        this.registerDefaultHandlers();
    }

    /**
     * Add middleware to the pipeline.
     * Middleware runs before the handler.
     */
    public use(middleware: (message: WebviewMessage, next: () => Promise<void>) => Promise<void>): void {
        this.middleware.push(middleware);
    }

    /**
     * Register a handler for a specific message type
     */
    public register<T extends WebviewMessageType>(
        type: T,
        handler: MessageHandlerFn<T>
    ): void {
        this.handlers.set(type, handler);
    }

    /**
     * Handle an incoming message from the webview
     */
    public async handle(message: WebviewMessage): Promise<void> {
        // Notify dispatcher first (for waiters)
        const data = 'data' in message ? message.data : undefined;
        this.messageDispatcher.notifyMessageReceived(message.type, data);

        // Skip test messages after notifying dispatcher
        if (message.type.startsWith('TEST_')) {
            return;
        }

        const runMiddleware = async (index: number): Promise<void> => {
            if (index < this.middleware.length) {
                const mw = this.middleware[index];
                await mw(message, () => runMiddleware(index + 1));
            } else {
                // Final step: execute handler
                const handler = this.handlers.get(message.type);
                if (!handler) {
                    return;
                }
                await handler(data);
            }
        };

        try {
            await runMiddleware(0);
        } catch (error) {
            console.error(`[WebviewMessageHandler] Error handling ${message.type}:`, error);
            vscode.window.showErrorMessage(
                `Error handling webview message: ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    /**
     * Register default handlers for common webview messages
     */
    private registerDefaultHandlers(): void {
        // Ready message - handled by dispatcher notification, no action needed
        this.register('ready', () => {
            // Ready state is handled by dispatcher
        });

        // Error messages
        this.register('error', (data: { message: string }) => {
            vscode.window.showErrorMessage(`3D World Error: ${data.message}`);
        });

        // Log messages - can be enabled for debugging
        this.register('log', () => {
            // Webview logs forwarded - can be enabled for debugging
        });

        // Object focused - no-op, visual highlighting handled internally
        this.register('objectFocused', () => {
            // Visual highlighting is handled internally by the webview
        });
    }
}
