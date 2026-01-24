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
            // Log message handling for debugging
            if (process.env.NODE_ENV === 'development') {
                console.log(`[MessageRouter] Handling: ${message.type}`);
            }
            return message;
        });

        // Expose globally for VSCode extension or debugging
        (window as any).world = world;
        (window as any).router = router;

        // Enhance logging by wrapping console methods
        const originalLog = console.log;
        console.log = (...args) => {
            originalLog(...args);
            const msg = args.map(a => String(a)).join(' ');
            logToExtension('log', msg);
        };

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
