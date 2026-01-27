/**
 * Webview Coordinator - Manages webview lifecycle with proper synchronization
 * 
 * Eliminates race conditions between webview creation, message sending, and disposal
 * by using a promise-based coordination system.
 */

import * as vscode from 'vscode';
import { LifecycleCoordinator, EventType } from './lifecycle-coordinator';
import { ExtensionMessage, WebviewMessage } from '../shared/messages';

export interface WebviewState {
    id: string;
    panel: vscode.WebviewPanel;
    isReady: boolean;
    readyPromise: Promise<void>;
    readyResolver: () => void;
    messageQueue: ExtensionMessage[];
    disposables: vscode.Disposable[];
}

/**
 * Coordinates webview operations with proper lifecycle management
 */
export class WebviewCoordinator {
    private webviews: Map<string, WebviewState> = new Map();
    private messageHandlers: Map<string, (data: any) => void> = new Map();

    constructor(private coordinator: LifecycleCoordinator) {
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for lifecycle coordination
     */
    private setupEventListeners(): void {
        this.coordinator.on(EventType.RELOAD_REQUESTED, async () => {
            await this.disposeAllWebviews();
        });

        this.coordinator.on(EventType.WEBVIEW_CREATED, async (data) => {
            await this.handleWebviewCreated(data);
        });

        this.coordinator.on(EventType.WEBVIEW_DISPOSED, async (data) => {
            await this.handleWebviewDisposed(data);
        });
    }

    /**
     * Register an existing webview panel with coordination
     */
    public async registerWebview(panel: vscode.WebviewPanel): Promise<void> {
        const webviewId = panel.viewType;

        // Check if webview already exists
        if (this.webviews.has(webviewId)) {
            console.warn(`[WebviewCoordinator] Webview ${webviewId} already registered`);
            return;
        }

        // Create ready promise
        let readyResolver: () => void;
        const readyPromise = new Promise<void>((resolve) => {
            readyResolver = resolve;
        });

        // Setup webview state
        const webviewState: WebviewState = {
            id: webviewId,
            panel,
            isReady: false,
            readyPromise,
            readyResolver: readyResolver!,
            messageQueue: [],
            disposables: []
        };

        // Setup event listeners
        this.setupWebviewListeners(webviewState);

        // Store webview state
        this.webviews.set(webviewId, webviewState);

        // Emit creation event
        await this.coordinator.emitEvent(EventType.WEBVIEW_CREATED, { webviewId, panel }, 'webview_coordinator');
    }

    /**
     * Create a new webview with proper coordination
     */
    public async createWebview(
        viewType: string,
        title: string,
        showOptions: vscode.ViewColumn | { viewColumn: vscode.ViewColumn; preserveFocus?: boolean },
        options?: vscode.WebviewOptions & vscode.WebviewPanelOptions
    ): Promise<vscode.WebviewPanel> {
        const webviewId = `${viewType}_${Date.now()}`;
        
        console.log(`[WebviewCoordinator] Creating webview: ${webviewId}`);

        // Create ready promise
        let readyResolver: () => void;
        const readyPromise = new Promise<void>((resolve) => {
            readyResolver = resolve;
        });

        // Create the panel
        const panel = vscode.window.createWebviewPanel(
            viewType,
            title,
            showOptions,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                ...options
            }
        );

        // Setup webview state
        const webviewState: WebviewState = {
            id: webviewId,
            panel,
            isReady: false,
            readyPromise,
            readyResolver: readyResolver!,
            messageQueue: [],
            disposables: []
        };

        // Setup event listeners
        this.setupWebviewListeners(webviewState);

        // Store webview state
        this.webviews.set(webviewId, webviewState);

        // Emit creation event
        await this.coordinator.emitEvent(EventType.WEBVIEW_CREATED, { webviewId, panel }, 'webview_coordinator');

        return panel;
    }

    /**
     * Setup webview event listeners
     */
    private setupWebviewListeners(webviewState: WebviewState): void {
        const { panel, disposables } = webviewState;

        // Message listener
        const messageListener = panel.webview.onDidReceiveMessage(
            (message: WebviewMessage) => this.handleWebviewMessage(webviewState, message),
            undefined,
            disposables
        );

        // Dispose listener
        const disposeListener = panel.onDidDispose(
            () => this.handleWebviewDispose(webviewState),
            undefined,
            disposables
        );

        // Visibility change listener
        const visibilityListener = panel.onDidChangeViewState(
            (e) => this.handleVisibilityChange(webviewState, e),
            undefined,
            disposables
        );
    }

    /**
     * Handle incoming webview messages
     */
    private async handleWebviewMessage(webviewState: WebviewState, message: WebviewMessage): Promise<void> {
        console.log(`[WebviewCoordinator] Received message: ${message.type} from ${webviewState.id}`);

        // Handle ready message
        if (message.type === 'ready') {
            webviewState.isReady = true;
            webviewState.readyResolver();
            
            // Flush queued messages
            await this.flushMessageQueue(webviewState);
            
            // Emit ready event
            await this.coordinator.emitEvent(EventType.WEBVIEW_READY, { webviewId: webviewState.id }, 'webview_coordinator');
            return;
        }

        // Handle other messages
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
            try {
                // Extract data safely - some messages don't have data
                const data = 'data' in message ? message.data : undefined;
                await handler(data);
            } catch (error) {
                console.error(`[WebviewCoordinator] Error handling message ${message.type}:`, error);
            }
        }
    }

    /**
     * Handle webview disposal
     */
    private async handleWebviewDispose(webviewState: WebviewState): Promise<void> {
        console.log(`[WebviewCoordinator] Webview disposed: ${webviewState.id}`);

        // Dispose all listeners
        webviewState.disposables.forEach(d => d.dispose());
        webviewState.disposables = [];

        // Remove from storage
        this.webviews.delete(webviewState.id);

        // Emit disposal event
        await this.coordinator.emitEvent(EventType.WEBVIEW_DISPOSED, { webviewId: webviewState.id }, 'webview_coordinator');
    }

    /**
     * Handle visibility changes
     */
    private async handleVisibilityChange(webviewState: WebviewState, event: vscode.WebviewPanelOnDidChangeViewStateEvent): Promise<void> {
        if (event.webviewPanel.visible && !webviewState.isReady) {
            // Webview became visible but not ready - might need to resend ready signal
            console.log(`[WebviewCoordinator] Webview became visible: ${webviewState.id}`);
        }
    }

    /**
     * Send message to webview with proper coordination
     */
    public async sendMessage(webviewId: string, message: ExtensionMessage): Promise<void> {
        const webviewState = this.webviews.get(webviewId);
        
        if (!webviewState) {
            console.warn(`[WebviewCoordinator] Attempted to send message to unknown webview: ${webviewId}`);
            return;
        }

        if (webviewState.isReady) {
            // Send immediately if ready
            this.doSendMessage(webviewState, message);
        } else {
            // Queue message if not ready
            console.log(`[WebviewCoordinator] Queuing message for ${webviewId}: ${message.type}`);
            webviewState.messageQueue.push(message);
        }
    }

    /**
     * Send message to all webviews
     */
    public async broadcastMessage(message: ExtensionMessage): Promise<void> {
        const promises = Array.from(this.webviews.keys()).map(webviewId => 
            this.sendMessage(webviewId, message)
        );
        
        await Promise.all(promises);
    }

    /**
     * Wait for webview to be ready
     */
    public async waitForReady(webviewId: string, timeoutMs = 10000): Promise<void> {
        const webviewState = this.webviews.get(webviewId);
        
        if (!webviewState) {
            throw new Error(`Webview not found: ${webviewId}`);
        }

        if (webviewState.isReady) {
            return;
        }

        // Wait with timeout
        const timeoutPromise = new Promise<void>((_, reject) => {
            setTimeout(() => reject(new Error(`Webview ready timeout: ${webviewId}`)), timeoutMs);
        });

        await Promise.race([webviewState.readyPromise, timeoutPromise]);
    }

    /**
     * Register message handler
     */
    public registerMessageHandler(messageType: string, handler: (data: any) => void): void {
        this.messageHandlers.set(messageType, handler);
    }

    /**
     * Unregister message handler
     */
    public unregisterMessageHandler(messageType: string): void {
        this.messageHandlers.delete(messageType);
    }

    /**
     * Get webview state
     */
    public getWebviewState(webviewId: string): WebviewState | undefined {
        return this.webviews.get(webviewId);
    }

    /**
     * Get all webview states
     */
    public getAllWebviewStates(): WebviewState[] {
        return Array.from(this.webviews.values());
    }

    /**
     * Dispose all webviews
     */
    public async disposeAllWebviews(): Promise<void> {
        console.log(`[WebviewCoordinator] Disposing ${this.webviews.size} webviews...`);
        
        const disposePromises = Array.from(this.webviews.values()).map(webviewState => 
            webviewState.panel.dispose()
        );
        
        await Promise.all(disposePromises);
        this.webviews.clear();
    }

    // Private helper methods
    private async handleWebviewCreated(data: any): Promise<void> {
        console.log(`[WebviewCoordinator] Webview created event: ${data.webviewId}`);
    }

    private async handleWebviewDisposed(data: any): Promise<void> {
        console.log(`[WebviewCoordinator] Webview disposed event: ${data.webviewId}`);
    }

    private doSendMessage(webviewState: WebviewState, message: ExtensionMessage): void {
        try {
            webviewState.panel.webview.postMessage(message);
        } catch (error) {
            console.error(`[WebviewCoordinator] Failed to send message to ${webviewState.id}:`, error);
        }
    }

    private async flushMessageQueue(webviewState: WebviewState): Promise<void> {
        if (webviewState.messageQueue.length === 0) {
            return;
        }

        console.log(`[WebviewCoordinator] Flushing ${webviewState.messageQueue.length} queued messages for ${webviewState.id}`);

        const messages = [...webviewState.messageQueue];
        webviewState.messageQueue = [];

        for (const message of messages) {
            this.doSendMessage(webviewState, message);
        }
    }
}
