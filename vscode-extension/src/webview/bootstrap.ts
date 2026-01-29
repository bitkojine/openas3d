import { World } from './world';
import { ExtensionMessage } from '../shared/messages';
import { MessageRouter } from './message-router';

// Initialize the world when the page loads
let world: World;
let router: MessageRouter;
let vscode: any; // Store vscode API for use in message handler

// Declare global API
declare const acquireVsCodeApi: () => any;

// Helper to log to VSCode
// We will initialize this in DOMContentLoaded
let logToExtension: (type: 'log' | 'error', message: string) => void = () => { };

window.addEventListener('DOMContentLoaded', () => {
    try {
        vscode = acquireVsCodeApi();
        logToExtension = (type, message) => {
            vscode.postMessage({ type, data: { message } });
        };
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
            // TODO: Add proper logging with new logger infrastructure when available
            // logger.debug(`[MessageRouter] Handling: ${message.type}`);
            return message;
        });

        // Expose globally for VSCode extension or debugging
        (window as any).world = world;
        (window as any).router = router;

        // Console wrapping removed for CI compliance
        // TODO: Implement proper logging infrastructure when available

        const originalError = console.error;
        console.error = (...args) => {
            originalError(...args);
            const msg = args.map(a => String(a)).join(' ');
            logToExtension('error', msg);
        };

        // Notify extension that we are ready
        vscode.postMessage({ type: 'ready' });

    } catch (error: any) {
        console.error('Failed to initialize World:', error);
        vscode.postMessage({
            type: 'error',
            data: { message: `Bootstrap Error: ${error.message || error}` }
        });
    }
});

// Handle messages from VSCode extension
window.addEventListener('message', async (event: MessageEvent<ExtensionMessage>) => {
    // Verify message origin - only accept messages from VSCode extension host
    if (!event.origin.startsWith('vscode-webview://')) {
        // Message from untrusted origin ignored for security
        return;
    }

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
