// src/webview/messaging-webview.ts

/**
 * VSCode Webview global API
 * Declares the VSCode API for TypeScript
 */
declare const acquireVsCodeApi: () => {
    postMessage: (msg: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

/**
 * Type for message handlers in the webview
 */
export type WebviewMessageHandler = (data: any) => void;

/**
 * Centralized messaging service for Webview ↔ Extension communication.
 */
export class WebviewMessaging {
    private handlers: Map<string, WebviewMessageHandler> = new Map();
    private vscode: ReturnType<typeof acquireVsCodeApi> = acquireVsCodeApi();

    constructor() {
        // Listen for messages from the extension
        window.addEventListener('message', (event) => {
            const msg = event.data;
            const handler = this.handlers.get(msg.type);
            if (handler) {
                handler(msg.data);
            } else {
                console.warn(`[WebviewMessaging] Unhandled message type: ${msg.type}`);
            }
        });
    }

    /**
     * Register a handler for a specific message type
     */
    register(type: string, handler: WebviewMessageHandler) {
        this.handlers.set(type, handler);
    }

    /**
     * Send a message to the extension
     */
    send(type: string, data: any) {
        this.vscode.postMessage({ type, data });
    }
}
