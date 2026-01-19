import { WorldRenderer } from './world-renderer';

// Initialize the renderer when the page loads
let worldRenderer: WorldRenderer;

window.addEventListener('DOMContentLoaded', () => {
    worldRenderer = new WorldRenderer();

    // Expose globally for VSCode extension or debugging
    (window as any).worldRenderer = worldRenderer;
});

// Handle messages from VSCode extension
window.addEventListener('message', (event) => {
    const message = event.data;
    if (!worldRenderer) return;

    switch (message.type) {
        case 'loadWorld':
            worldRenderer.clear();
            console.log('Loading world data:', message.data);
            break;

        case 'addObject':
            worldRenderer.addCodeObject(message.data);
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
});
