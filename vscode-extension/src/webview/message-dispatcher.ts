/**
 * MessageDispatcher - Handles sending messages to webview and waiting for responses
 * 
 * Single Responsibility: Message protocol communication with webview.
 * Does NOT handle incoming message routing (that's handled by WebviewMessageHandler).
 */

import * as vscode from 'vscode';
import { ExtensionMessage } from '../shared/messages';

export class MessageDispatcher {
    private messageWaiters: Array<{ type: string; resolve: (data: unknown) => void }> = [];
    private isReady = false;

    constructor(private getPanel: () => vscode.WebviewPanel | undefined) { }

    /**
     * Send a message to the webview
     */
    public sendMessage(message: ExtensionMessage): void {
        const panel = this.getPanel();
        if (panel) {
            panel.webview.postMessage(message);
        }
    }

    /**
     * Alias for sendMessage (for backward compatibility)
     */
    public dispatchMessage(message: ExtensionMessage): void {
        this.sendMessage(message);
    }

    /**
     * Wait for a specific message type from the webview
     * Used primarily for testing
     */
    public waitForMessage(type: string): Promise<unknown> {
        return new Promise(resolve => {
            this.messageWaiters.push({ type, resolve });
        });
    }

    /**
     * Notify that a message was received (called by WebviewMessageHandler)
     * This resolves any waiters waiting for that message type
     */
    public notifyMessageReceived(type: string, data?: unknown): void {
        const waiterIndex = this.messageWaiters.findIndex(w => w.type === type);
        if (waiterIndex !== -1) {
            const waiter = this.messageWaiters[waiterIndex];
            this.messageWaiters.splice(waiterIndex, 1);
            waiter.resolve(data);
        }

        if (type === 'ready') {
            this.isReady = true;
        }
    }

    /**
     * Check if webview is ready
     */
    public getReady(): boolean {
        return this.isReady;
    }

    /**
     * Reset ready state (when panel is recreated)
     */
    public resetReady(): void {
        this.isReady = false;
    }

    /**
     * Wait until webview is ready
     */
    public async ensureReady(): Promise<void> {
        if (this.isReady) {
            return;
        }
        await this.waitForMessage('ready');
    }
}
