import * as vscode from 'vscode';
import * as path from 'path';
import { CodebaseAnalyzer } from './codebase-analyzer';
import { CodebaseLayoutEngine } from './codebase-layout';
import { CodeFile, DependencyEdge } from './types';
import { analyzeArchitecture, FileWithZone, Dependency } from './architecture-analyzer';

// Re-export types for backward compatibility within the module if needed
export { CodeFile, DependencyEdge };
/**
 * Facade class for the VSCode extension loader.
 * Orchestrates analysis and layout to visualize the codebase in 3D.
 */
export class CodebaseVisualizer {

    private panel: vscode.WebviewPanel | null = null;
    private layout = new CodebaseLayoutEngine();
    private fileIndex = 0;
    private fileZoneCounts: { [zone: string]: number } = {};
    private filesWithZones: FileWithZone[] = [];

    public async initialize(panel: vscode.WebviewPanel, data: { targetPath: string }): Promise<() => void> {
        this.panel = panel;
        this.fileIndex = 0;
        this.fileZoneCounts = {};
        this.filesWithZones = [];

        // Clear immediately - UI shows instantly
        this.panel.webview.postMessage({ type: 'clear' });

        const analyzer = new CodebaseAnalyzer(data.targetPath);

        // Start streaming - don't await! Files will appear progressively
        analyzer.analyzeStreaming(
            (file) => this.addFileToScene(file),
            (edges) => {
                this.addEdgesToScene(edges);

                // Compute zone bounds from accumulated file counts (streaming mode)
                const zoneBounds = this.layout.computeZoneBoundsFromCounts(this.fileZoneCounts);

                this.panel?.webview.postMessage({
                    type: 'setZoneBounds',
                    data: zoneBounds
                });

                this.panel?.webview.postMessage({ type: 'dependenciesComplete' });

                // Analyze architecture and send warnings
                const dependencies: Dependency[] = edges.map(e => ({
                    sourceId: e.source,
                    targetId: e.target
                }));
                const warnings = analyzeArchitecture(this.filesWithZones, dependencies);

                this.panel?.webview.postMessage({
                    type: 'setWarnings',
                    data: warnings
                });
            }
        ).catch(err => {
            console.error('Failed during streaming analysis:', err);
            vscode.window.showErrorMessage(`Failed to analyze codebase: ${err}`);
        });

        return () => this.cleanup();
    }

    private addFileToScene(file: CodeFile): void {
        if (!this.panel) { return; }

        // Compute position based on zone and file count in that zone
        const zone = this.layout.getZoneForFile(file);
        if (!this.fileZoneCounts[zone]) { this.fileZoneCounts[zone] = 0; }
        const indexInZone = this.fileZoneCounts[zone]++;
        const pos2D = this.layout.getPositionForZone(zone, indexInZone);

        // Track file with zone for architecture analysis
        this.filesWithZones.push({
            id: file.id,
            filePath: file.filePath,
            zone
        });

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
        if (!this.panel) { return; }

        edges.forEach(edge => {
            this.panel!.webview.postMessage({
                type: 'addDependency',
                data: {
                    id: `${edge.source}-${edge.target}`,
                    source: edge.source,
                    target: edge.target,
                    type: edge.type,
                    weight: edge.weight ?? 1,
                    isCircular: edge.isCircular ?? false,
                    importKind: edge.importKind ?? 'value'
                }
            });
        });
    }

    private cleanup() {
        this.panel = null;
    }
}
