import { World } from './world';

// Initialize the world when the page loads
let world: World;

// Declare global API
declare const acquireVsCodeApi: () => any;

// Helper to log to VSCode
// We will initialize this in DOMContentLoaded
let logToExtension: (type: 'log' | 'error', message: string) => void = () => { };

window.addEventListener('DOMContentLoaded', () => {
    let vscode: any;
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
        // Expose globally for VSCode extension or debugging
        (window as any).world = world;
        (window as any).worldRenderer = world; // Backwards compatibility for now

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
window.addEventListener('message', (event) => {
    const message = event.data;
    // console.log('[Bootstrap] Received message:', message.type);

    if (!world) {
        console.error('[Bootstrap] World not initialized, dropping message:', message.type);
        return;
    }

    try {
        switch (message.type) {
            case 'loadWorld':
                world.clear();
                break;

            case 'addObject':
                try {
                    world.addCodeObject(message.data);
                } catch (e: any) {
                    console.error(`Failed to add object ${message.data.id}:`, e);
                }
                break;

            case 'removeObject':
                world.removeCodeObject(message.data.id);
                break;

            case 'addDependency':
                world.addDependency(message.data);
                break;

            case 'removeDependency':
                world.removeDependency(message.data.id);
                break;

            case 'showDependencies':
                world.showAllDependencies();
                break;

            case 'hideDependencies':
                world.hideDependencies();
                break;

            case 'dependenciesComplete':
                world.refreshLabels();
                break;

            case 'setZoneBounds':
                world.setZoneBounds(message.data);
                break;

            case 'setWarnings':
                world.setWarnings(message.data);
                break;

            case 'architectureError':
                console.error('[Webview] Architecture Analysis Error:', message.data.message);
                // In the future, we could show a toast or UI notification here
                break;

            case 'clear':
                world.clear();
                break;

            case 'perfUpdate':
                const perfPanel = document.getElementById('perf-panel');
                if (perfPanel) {
                    perfPanel.textContent = message.data.report;
                }
                break;

            default:
                console.warn('Unknown message type:', message.type);
        }
    } catch (err: any) {
        console.error('Critical error in message handler:', err);
    }
});
