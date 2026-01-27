import { World } from './world';
import { ExtensionMessage } from '../shared/messages';
import { MessageRouter } from './message-router';
import { WebviewLogger, LogLevel } from './utils/webview-logger';

// Initialize the world when the page loads
let world: World;
let router: MessageRouter;
let vscode: any; // Store vscode API for use in message handler

// Declare global API
declare const acquireVsCodeApi: () => any;

// Helper to log to VSCode
export let logger: WebviewLogger;

window.addEventListener('DOMContentLoaded', () => {
    try {
        vscode = acquireVsCodeApi();
        logger = new WebviewLogger(vscode);
        // Expose globally for debugging
        (window as any).logger = logger;
    } catch (e) {
        console.error('Failed to acquire VSCode API:', e);
        return;
    }

    try {
        world = new World(vscode);
        router = new MessageRouter();

        // Register all message handlers
        world.registerMessageHandlers(router);

        // Add middleware for logging (optional - can be disabled in production)
        router.use((message) => {
            // Log message handling for debugging
            logger.debug(`[MessageRouter] Handling: ${message.type}`);
            return message;
        });

        // Expose globally for VSCode extension or debugging
        (window as any).world = world;
        (window as any).router = router;

        // Use the new logger instead of wrapping console
        // We can still keep console.log for local dev tools if desired, 
        // but the logger will handle the extension communication.

        // Notify extension that we are ready
        vscode.postMessage({ type: 'ready' });

    } catch (error: any) {
        if (logger) {
            logger.error('Failed to initialize World', error);
        } else {
            console.error('Failed to initialize World:', error);
            vscode.postMessage({
                type: 'error',
                data: { message: `Bootstrap Error: ${error.message || error}` }
            });
        }
    }
});

// Handle messages from VSCode extension
window.addEventListener('message', async (event: MessageEvent<ExtensionMessage>) => {
    const message = event.data;

    if (!world || !router) {
        console.error('[Bootstrap] World or router not initialized, dropping message:', message.type);
        return;
    }

    try {
        await router.handle(message);
    } catch (err: any) {
        console.error('[Bootstrap] Critical error in message handler:', err);
        // Optionally send error back to extension
        vscode.postMessage({
            type: 'error',
            data: { message: `Message handling error: ${err.message || err}` }
        });
    }
});
