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
        this.panel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
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
    OPEN_FILE: 'openFile',       // existing single file
    OPEN_FILES: 'openFiles',     // new type for code + description
    ERROR: 'error',
    CAMERA_MOVED: 'cameraMoved'
} as const;

/**
 * Registers the handler to open code + description files
 * Call this after creating the MessageHandler instance
 */
export function registerOpenFilesHandler(handler: MessageHandler) {
    handler.registerHandler(MessageTypes.OPEN_FILES, async (data: { codeFile: string; descriptionFile: string }) => {
        try {
            // Open code file
            const codeUri = vscode.Uri.file(data.codeFile);
            const codeDoc = await vscode.workspace.openTextDocument(codeUri);
            await vscode.window.showTextDocument(codeDoc, { preview: false });

            // Open description file
            const descUri = vscode.Uri.file(data.descriptionFile);
            const descDoc = await vscode.workspace.openTextDocument(descUri);
            await vscode.window.showTextDocument(descDoc, { preview: false });
        } catch (err) {
            console.error('Failed to open files:', err);
            handler.sendToWebview({ type: MessageTypes.ERROR, data: err });
        }
    });
}
