import * as vscode from 'vscode';
import * as path from 'path';
import { CodebaseAnalyzer } from './codebase-analyzer';
import { CodebaseLayoutEngine } from './codebase-layout';
import { CodeFile, DependencyEdge } from '../core/domain/code-file';
import { FileWithZone } from '../core/analysis/types';
import { analyzeArchitecture } from '../core/analysis/architecture-analyzer';
import { ExtensionMessage } from '../shared/messages';

// Re-export types for backward compatibility within the module if needed
import { LayoutPersistenceService } from '../services/layout-persistence';

export { CodeFile, DependencyEdge };
/**
 * Facade class for the VSCode extension loader.
 * Orchestrates analysis and layout to visualize the codebase in 3D.
 */
export class CodebaseVisualizer {

    private panel: vscode.WebviewPanel | null = null;
    private layout: CodebaseLayoutEngine;
    private fileIndex = 0;
    private fileZoneCounts: { [zone: string]: number } = {};
    private filesWithZones: FileWithZone[] = [];
    private extensionPath: string;

    constructor(extensionPath: string, persistenceService?: LayoutPersistenceService) {
        this.extensionPath = extensionPath;
        this.layout = new CodebaseLayoutEngine(persistenceService);
    }

    private postMessage(message: ExtensionMessage): void {
        this.panel?.webview.postMessage(message);
    }

    public async initialize(panel: vscode.WebviewPanel, data: { targetPath: string }): Promise<() => void> {
        this.panel = panel;
        this.fileIndex = 0;
        this.fileZoneCounts = {};
        this.filesWithZones = [];

        // Clear immediately - UI shows instantly
        this.postMessage({ type: 'clear' });

        const analyzer = new CodebaseAnalyzer(data.targetPath);

        // Start streaming - don't await! Files will appear progressively
        analyzer.analyzeStreaming(
            (files) => {
                files.forEach(file => {
                    this.fileIndex++;
                    const zoneName = this.layout.getZoneForFile(file);
                    this.fileZoneCounts[zoneName] = (this.fileZoneCounts[zoneName] || 0) + 1;
                    this.filesWithZones.push({ ...file, zone: zoneName });
                });

                this.postMessage({
                    type: 'addObjects',
                    data: files.map(file => ({
                        id: file.id,
                        type: 'file',
                        filePath: file.filePath,
                        position: { x: (this.fileIndex % 10) * 2, y: 0, z: Math.floor(this.fileIndex / 10) * 2 }, // Temporary placement
                        size: {
                            width: Math.min(1 + file.size / 1000, 3),
                            height: Math.min(0.25 + file.lines * 0.025, 5),
                            depth: Math.min(1 + file.size / 1000, 3)
                        },
                        metadata: file
                    }))
                });
            },
            async (edges) => {
                // Batch add dependencies
                this.postMessage({
                    type: 'addDependencies',
                    data: edges.map(edge => ({
                        id: `${edge.source}-${edge.target}`,
                        source: edge.source,
                        target: edge.target,
                        type: 'import',
                        weight: edge.weight ?? 1,
                        isCircular: edge.isCircular ?? false,
                        importKind: edge.importKind ?? 'value'
                    }))
                });

                // Compute FINAL layout from accumulated file counts
                const zoneBounds = this.layout.computeZoneBoundsFromCounts(this.fileZoneCounts);

                this.postMessage({
                    type: 'setZoneBounds',
                    data: zoneBounds
                });

                // RE-CALCULATE POSITIONS FOR ALL FILES (BATCHED)
                const zoneIndices: { [zone: string]: number } = {};
                const positionUpdates: any[] = [];

                this.filesWithZones.forEach(f => {
                    const zoneName = f.zone;
                    const zone = this.layout.getZone(zoneName) || this.layout.getZone('core')!;

                    if (!zoneIndices[zoneName]) zoneIndices[zoneName] = 0;
                    const index = zoneIndices[zoneName]++;

                    const pos = this.layout.getPositionForZone(zone, index);
                    positionUpdates.push({
                        id: f.id,
                        position: { x: pos.x, y: 0, z: pos.z }
                    });
                });

                if (positionUpdates.length > 0) {
                    this.postMessage({
                        type: 'updateObjectPositions',
                        data: positionUpdates
                    });
                }

                this.postMessage({ type: 'dependenciesComplete' });

                // Analyze architecture (non-blocking)
                const fileIdMap = new Map<string, string>();
                this.filesWithZones.forEach(f => fileIdMap.set(f.filePath, f.id));

                analyzeArchitecture(data.targetPath, fileIdMap, { extensionPath: this.extensionPath }).then(warnings => {
                    this.postMessage({ type: 'setWarnings', data: warnings });
                }).catch(err => {
                    console.error('[Architecture] Analysis failed:', err);
                    this.postMessage({
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

    private cleanup() {
        this.panel = null;
    }
}
