/**
 * WebviewPanelManager - Facade that coordinates panel management services
 * 
 * This class maintains backward compatibility while delegating to focused services:
 * - PanelManager: Panel lifecycle
 * - MessageDispatcher: Message sending/waiting
 * - DescriptionSyncService: File watching and description updates
 * - EditorConfigService: Config syncing
 * - WebviewMessageHandler: Incoming message handling
 * 
 * This refactoring splits the original 368-line class into focused services.
 */

import * as vscode from 'vscode';
import { PanelManager } from './panel-manager';
import { MessageDispatcher } from './message-dispatcher';
import { DescriptionSyncService } from '../services/description-sync-service';
import { EditorConfigService } from '../services/editor-config-service';
import { WebviewMessageHandler } from './webview-message-handler';
import { ExtensionMessage, WebviewMessage } from '../shared/messages';
import { SignService } from '../services/sign-service';

export class WebviewPanelManager {
    private panelManager: PanelManager;
    private messageDispatcher: MessageDispatcher;
    private descriptionSync: DescriptionSyncService;
    private editorConfig: EditorConfigService;
    private messageHandler: WebviewMessageHandler;
    private context: vscode.ExtensionContext;

    constructor(context: vscode.ExtensionContext, perf: any, version: string = '0.0.0') {
        this.context = context;

        // Initialize panel manager
        this.panelManager = new PanelManager(context, version);

        // Initialize message dispatcher (needs panel getter)
        this.messageDispatcher = new MessageDispatcher(() => this.panelManager.getPanel());

        // Initialize services that send messages
        this.descriptionSync = new DescriptionSyncService((msg) => this.messageDispatcher.sendMessage(msg));
        this.editorConfig = new EditorConfigService((msg) => this.messageDispatcher.sendMessage(msg));

        // Initialize message handler
        this.messageHandler = new WebviewMessageHandler(this.messageDispatcher);

        // Register Performance Middleware
        this.messageHandler.use(async (msg, next) => {
            const label = `Message: ${msg.type}`;
            const start = perf.start(label);
            try {
                await next();
            } finally {
                perf.stop(label, start);
            }
        });

        // Register webview message handlers
        this.registerWebviewHandlers();
    }

    /**
     * Create or show the webview panel
     */
    public async createOrShowPanel(): Promise<vscode.WebviewPanel> {
        const panel = await this.panelManager.createOrShowPanel();

        // Set up message listener
        panel.webview.onDidReceiveMessage(
            (message) => this.messageHandler.handle(message as WebviewMessage),
            undefined,
            this.context.subscriptions
        );

        // Start watching for file/config changes
        this.descriptionSync.startWatching(this.context);
        this.editorConfig.startWatching(this.context);

        // Reset ready state when panel is recreated
        this.messageDispatcher.resetReady();

        return panel;
    }

    /**
     * Send a message to the webview
     */
    public sendMessage(message: ExtensionMessage): void {
        this.messageDispatcher.sendMessage(message);
    }

    /**
     * Dispatch a message (alias for sendMessage)
     */
    public dispatchMessage(message: ExtensionMessage): void {
        this.messageDispatcher.dispatchMessage(message);
    }

    /**
     * Wait for a specific message type (primarily for testing)
     */
    public waitForMessage(type: string): Promise<any> {
        return this.messageDispatcher.waitForMessage(type);
    }

    /**
     * Ensure webview is ready before sending messages
     */
    public async ensureReady(): Promise<void> {
        return this.messageDispatcher.ensureReady();
    }

    /**
     * Dispose the panel and stop all services
     */
    public dispose(): void {
        this.descriptionSync.stopWatching();
        this.panelManager.dispose();
    }

    /**
     * Check if panel exists
     */
    public hasPanel(): boolean {
        return this.panelManager.hasPanel();
    }

    /**
     * Register handlers for incoming webview messages
     */
    private registerWebviewHandlers(): void {
        // Object selection - reveal in explorer
        this.messageHandler.register('objectSelected', async (data: { filePath: string }) => {
            if (data.filePath) {
                try {
                    const uri = vscode.Uri.file(data.filePath);
                    await vscode.commands.executeCommand('revealInExplorer', uri);

                    // Immediately return focus to the webview
                    const panel = this.panelManager.getPanel();
                    if (panel) {
                        this.panelManager.reveal(undefined, false);
                    }
                } catch (error) {
                    console.warn('Failed to reveal in explorer:', error);
                }
            }
        });

        // Open file
        this.messageHandler.register('openFile', async (data: { filePath: string }) => {
            if (!data.filePath) {
                return;
            }

            try {
                const uri = vscode.Uri.file(data.filePath);
                const document = await vscode.workspace.openTextDocument(uri);
                await vscode.window.showTextDocument(document);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open file: ${error}`);
            }
        });

        // Open files (code + description)
        this.messageHandler.register('openFiles', async (data: { codeFile: string }) => {
            try {
                const codeUri = vscode.Uri.file(data.codeFile);

                // Check existence
                try {
                    await vscode.workspace.fs.stat(codeUri);
                } catch {
                    vscode.window.showWarningMessage(`File does not exist: ${data.codeFile}`);
                    return;
                }

                // Open code file
                const codeDoc = await vscode.workspace.openTextDocument(codeUri);
                await vscode.window.showTextDocument(codeDoc, { preview: false });

                // Try to open description file
                const descUri = vscode.Uri.file(
                    data.codeFile.endsWith('.md') ? data.codeFile : data.codeFile + '.md'
                );

                try {
                    await vscode.workspace.fs.stat(descUri);
                    const descDoc = await vscode.workspace.openTextDocument(descUri);
                    await vscode.window.showTextDocument(descDoc, { preview: false });
                } catch {
                    // Description file doesn't exist, ignore
                }
            } catch (err) {
                vscode.window.showErrorMessage(`Failed to open files: ${err}`);
            }
        });

        // TDD: Run All Tests
        this.messageHandler.register('runAllTests', async () => {
            await vscode.commands.executeCommand('testing.runAll');
        });
    }

    /**
     * Register a handler for addSignAtPosition messages
     * This allows SignService to be injected without circular dependencies
     */
    public registerSignHandler(signService: SignService): void {
        this.messageHandler.register('addSignAtPosition', async (data: { position: { x: number; y: number; z: number } }) => {
            await signService.addSignAtPosition(data.position);
        });
    }

    /**
     * Register a handler for moveObject messages
     */
    public registerMoveHandler(handler: (id: string, pos: { x: number; y: number; z: number }) => Promise<void>): void {
        this.messageHandler.register('moveObject', async (data: { id: string; position: { x: number; y: number; z: number } }) => {
            await handler(data.id, data.position);
        });
    }
}
