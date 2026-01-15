import * as vscode from 'vscode';

export interface WebviewMessage {
    type: string;
    data?: any;
}

export interface ExtensionMessage {
    type: string;
    data?: any;
}

export class MessageHandler {
    private panel: vscode.WebviewPanel;
    private messageHandlers: Map<string, (data: any) => void> = new Map();

    constructor(panel: vscode.WebviewPanel) {
        this.panel = panel;
        this.setupMessageListener();
    }

    private setupMessageListener(): void {
        this.panel.webview.onDidReceiveMessage((message: WebviewMessage) => {
            const handler = this.messageHandlers.get(message.type);
            if (handler) {
                handler(message.data);
            } else {
                console.warn(`No handler registered for message type: ${message.type}`);
            }
        });
    }

    public registerHandler(messageType: string, handler: (data: any) => void): void {
        this.messageHandlers.set(messageType, handler);
    }

    public sendToWebview(message: ExtensionMessage): void {
        this.panel.webview.postMessage(message);
    }

    public dispose(): void {
        this.messageHandlers.clear();
    }
}

// Common message types
export const MessageTypes = {
    // Extension to Webview
    LOAD_WORLD: 'loadWorld',
    ADD_OBJECT: 'addObject',
    REMOVE_OBJECT: 'removeObject',
    CLEAR_WORLD: 'clear',
    UPDATE_OBJECT: 'updateObject',
    
    // Webview to Extension
    READY: 'ready',
    OBJECT_SELECTED: 'objectSelected',
    OPEN_FILE: 'openFile',
    ERROR: 'error',
    CAMERA_MOVED: 'cameraMoved'
} as const;