import * as vscode from 'vscode';

export type ExtensionMessageHandler = (data: any) => void;

/**
 * Centralized messaging service for Extension ↔ Webview communication.
 */
export class ExtensionMessaging {
    private handlers: Map<string, ExtensionMessageHandler> = new Map();

    constructor(private panel: vscode.WebviewPanel) {
        // Listen for messages from the webview
        panel.webview.onDidReceiveMessage((msg) => {
            const handler = this.handlers.get(msg.type);
            if (handler) {
                handler(msg.data);
            } else {
                console.warn(`[ExtensionMessaging] Unhandled message type: ${msg.type}`);
            }
        });
    }

    /**
     * Register a message handler for a specific message type
     */
    register(type: string, handler: ExtensionMessageHandler) {
        this.handlers.set(type, handler);
    }

    /**
     * Send a message to the webview
     */
    send(type: string, data: any) {
        this.panel.webview.postMessage({ type, data });
    }
}
