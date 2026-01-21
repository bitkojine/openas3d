import { WorldRenderer } from './world-renderer';

// Initialize the renderer when the page loads
let worldRenderer: WorldRenderer;

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
        worldRenderer = new WorldRenderer(vscode);
        // Expose globally for VSCode extension or debugging
        (window as any).worldRenderer = worldRenderer;

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

        console.log('Bootstrap finished. WorldRenderer initialized.');

        // Notify extension that we are ready ONLY after everything is set up
        vscode.postMessage({ type: 'ready' });

    } catch (error: any) {
        console.error('Failed to initialize WorldRenderer:', error);
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

    if (!worldRenderer) {
        console.error('[Bootstrap] WorldRenderer not initialized, dropping message:', message.type);
        return;
    }

    try {
        switch (message.type) {
            case 'loadWorld':
                worldRenderer.clear();
                console.log('Loading world data:', message.data);
                break;

            case 'addObject':
                console.log('Adding object:', message.data.id);
                try {
                    worldRenderer.addCodeObject(message.data);
                } catch (e: any) {
                    console.error(`Failed to add object ${message.data.id}:`, e);
                }
                break;

            case 'removeObject':
                worldRenderer.removeCodeObject(message.data.id);
                break;

            case 'addDependency':
                worldRenderer.addDependency(message.data);
                break;

            case 'removeDependency':
                worldRenderer.removeDependency(message.data.id);
                break;

            case 'showDependencies':
                worldRenderer.showAllDependencies();
                break;

            case 'hideDependencies':
                worldRenderer.hideDependencies();
                break;

            case 'dependenciesComplete':
                worldRenderer.refreshLabels();
                break;

            case 'clear':
                worldRenderer.clear();
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
