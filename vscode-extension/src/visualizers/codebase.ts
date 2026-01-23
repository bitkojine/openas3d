import * as vscode from 'vscode';
import * as path from 'path';
import { CodebaseAnalyzer } from './codebase-analyzer';
import { CodebaseLayoutEngine } from './codebase-layout';
import { CodeFile, DependencyEdge } from './types';
import { FileWithZone } from '../core/analysis/types';
import { analyzeArchitecture } from '../core/analysis/architecture-analyzer';

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
    private extensionPath: string;

    constructor(extensionPath: string) {
        this.extensionPath = extensionPath;
    }

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

                // Compute FINAL layout from accumulated file counts
                // This ensures zones are sized correctly based on actual content
                this.layout.computeZoneBoundsFromCounts(this.fileZoneCounts);
                const zoneBounds = this.layout.computeZoneBoundsFromCounts(this.fileZoneCounts);

                this.panel?.webview.postMessage({
                    type: 'setZoneBounds',
                    data: zoneBounds
                });

                // RE-CALCULATE POSITIONS FOR ALL FILES
                // Now that layout is final, we must update all file positions
                // because zones may have shifted significantly
                const zoneIndices: { [zone: string]: number } = {};

                this.filesWithZones.forEach(f => {
                    const zoneName = f.zone;
                    const zone = this.layout.getZone(zoneName) || this.layout.getZone('core')!;

                    if (!zoneIndices[zoneName]) zoneIndices[zoneName] = 0;
                    const index = zoneIndices[zoneName]++;

                    const pos = this.layout.getPositionForZone(zone, index);

                    this.panel?.webview.postMessage({
                        type: 'updateObjectPosition',
                        data: {
                            id: f.id,
                            position: { x: pos.x, y: 0, z: pos.z }
                        }
                    });
                });

                this.panel?.webview.postMessage({ type: 'dependenciesComplete' });

                // Analyze architecture and send warnings
                // Create map of absolute path -> file ID
                const fileIdMap = new Map<string, string>();
                this.filesWithZones.forEach(f => fileIdMap.set(f.filePath, f.id));

                analyzeArchitecture(data.targetPath, fileIdMap, { extensionPath: this.extensionPath }).then(warnings => {
                    this.panel?.webview.postMessage({
                        type: 'setWarnings',
                        data: warnings
                    });
                }).catch(err => {
                    console.error('[Architecture] Analysis failed:', err);
                    this.panel?.webview.postMessage({
                        type: 'architectureError',
                        data: { message: `Architecture analysis failed: ${err.message || err}` }
                    });
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
        const zoneName = this.layout.getZoneForFile(file);
        if (!this.fileZoneCounts[zoneName]) { this.fileZoneCounts[zoneName] = 0; }
        const indexInZone = this.fileZoneCounts[zoneName]++;

        const zone = this.layout.getZone(zoneName) || this.layout.getZone('core')!;
        const pos2D = this.layout.getPositionForZone(zone, indexInZone);

        // Track file with zone for architecture analysis
        this.filesWithZones.push({
            id: file.id,
            filePath: file.filePath,
            zone: zoneName
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
