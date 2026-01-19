import * as vscode from 'vscode';
import * as path from 'path';
import { WorldVisualizer, VisualizerManifest } from './loader';
import { CodebaseAnalyzer } from './codebase-analyzer';
import { CodebaseLayoutEngine } from './codebase-layout';
import { CodeFile, DependencyEdge } from './types';

// Re-export types for backward compatibility within the module if needed
export { CodeFile, DependencyEdge };

/**
 * Facade class for the VSCode extension loader.
 * Orchestrates analysis and layout to visualize the codebase in 3D.
 */
export class CodebaseVisualizer implements WorldVisualizer {
    public manifest: VisualizerManifest = {
        name: 'Codebase Dependencies Visualizer',
        type: 'codebase',
        version: '1.0.0',
        languages: ['typescript', 'javascript', 'python', 'java', 'go'],
        description: 'Visualize code dependencies and architecture in 3D'
    };

    private panel: vscode.WebviewPanel | null = null;
    private layout = new CodebaseLayoutEngine();
    private fileIndex = 0;
    private fileZoneCounts: { [zone: string]: number } = {};

    public async initialize(panel: vscode.WebviewPanel, data: { targetPath: string }): Promise<() => void> {
        this.panel = panel;
        this.fileIndex = 0;
        this.fileZoneCounts = {};

        // Clear immediately - UI shows instantly
        this.panel.webview.postMessage({ type: 'clear' });

        const analyzer = new CodebaseAnalyzer(data.targetPath);

        // Start streaming - don't await! Files will appear progressively
        analyzer.analyzeStreaming(
            (file) => this.addFileToScene(file),
            (edges) => this.addEdgesToScene(edges)
        ).catch(err => {
            console.error('Failed during streaming analysis:', err);
            vscode.window.showErrorMessage(`Failed to analyze codebase: ${err}`);
        });

        return () => this.cleanup();
    }

    private addFileToScene(file: CodeFile): void {
        if (!this.panel) return;

        // Compute position based on zone and file count in that zone
        const zone = this.layout.getZoneForFile(file);
        if (!this.fileZoneCounts[zone]) this.fileZoneCounts[zone] = 0;
        const indexInZone = this.fileZoneCounts[zone]++;
        const pos2D = this.layout.getPositionForZone(zone, indexInZone);

        this.panel.webview.postMessage({
            type: 'addObject',
            data: {
                id: file.id,
                type: 'file',
                filePath: file.filePath,
                position: { x: pos2D.x, y: 0, z: pos2D.z },
                size: {
                    width: Math.min(1 + file.size / 1000, 3),
                    height: Math.min(0.25 + file.lines * 0.025, 5),
                    depth: Math.min(1 + file.size / 1000, 3)
                },
                metadata: file
            }
        });
    }

    private addEdgesToScene(edges: DependencyEdge[]): void {
        if (!this.panel) return;

        edges.forEach(edge => {
            this.panel!.webview.postMessage({
                type: 'addDependency',
                data: {
                    id: `${edge.source}-${edge.target}`,
                    source: edge.source,
                    target: edge.target,
                    type: edge.type,
                    color: 0x00BFFF,
                    opacity: 0.6
                }
            });
        });
    }

    private cleanup() {
        this.panel = null;
    }
}
