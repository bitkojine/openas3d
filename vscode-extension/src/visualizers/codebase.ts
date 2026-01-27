import * as vscode from 'vscode';
import * as path from 'path';
import { CodebaseAnalyzer } from './codebase-analyzer';
import { CodebaseLayoutEngine } from './codebase-layout';
import { MONUMENT_CONFIG } from './monument-config';
import { CodeFile, DependencyEdge } from '../core/domain/code-file';
import { FileWithZone } from '../core/analysis/types';
import { analyzeArchitecture } from '../core/analysis/architecture-analyzer';
import { ExtensionMessage } from '../shared/messages';

// Re-export types for backward compatibility within the module if needed
import { LayoutPersistenceService } from '../services/layout-persistence';
import { AnalysisCacheService } from '../services/analysis-cache';

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
    private cacheService?: AnalysisCacheService;

    constructor(extensionPath: string, persistenceService?: LayoutPersistenceService, cacheService?: AnalysisCacheService) {
        this.extensionPath = extensionPath;
        this.layout = new CodebaseLayoutEngine(persistenceService);
        this.cacheService = cacheService;
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

        const initStart = Date.now();
        console.time('[CodebaseVisualizer] Initialization');

        // Initialize Hot Reload Monument
        this.postMessage({
            type: 'updateMonument',
            data: MONUMENT_CONFIG
        });

        // ───── Check Cache ─────
        const cache = this.cacheService?.getCache(data.targetPath);
        if (cache) {
            const cacheStart = Date.now();
            console.log(`[CodebaseVisualizer] Instant load from cache: ${cache.files.length} files`);

            // Replay files
            cache.files.forEach(f => this.addFileToScene(f));

            // Finalize layout - await it to keep timers nested correctly
            await this.finalizeScene(cache.edges, data.targetPath);
            console.log(`[CodebaseVisualizer] Cached load complete in ${Date.now() - cacheStart}ms`);

            return () => this.cleanup();
        }

        console.log('[CodebaseVisualizer] No cache found, starting fresh analysis...');
        const analyzer = new CodebaseAnalyzer(data.targetPath);
        const discoveredFiles: CodeFile[] = [];

        // Start streaming - don't await! Files will appear progressively
        analyzer.analyzeStreaming(
            (file) => {
                discoveredFiles.push(file);
                this.addFileToScene(file);
            },
            (edges) => {
                // Save to cache
                this.cacheService?.setCache(data.targetPath, discoveredFiles, edges);

                this.finalizeScene(edges, data.targetPath);
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

        this.postMessage({
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
            this.postMessage({
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

    private async finalizeScene(edges: DependencyEdge[], targetPath: string): Promise<void> {
        this.addEdgesToScene(edges);

        // Compute FINAL layout from accumulated file counts
        // This ensures zones are sized correctly based on actual content
        const zoneBounds = this.layout.computeZoneBoundsFromCounts(this.fileZoneCounts);

        this.postMessage({
            type: 'setZoneBounds',
            data: zoneBounds
        });

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
                type: 'updateBatch',
                data: {
                    type: 'position',
                    updates: positionUpdates
                }
            });
        }

        this.postMessage({ type: 'dependenciesComplete' });
        console.timeEnd('[CodebaseVisualizer] Initialization');

        // Analyze architecture and send warnings - AWAIT this to keep PerfTracker happy
        // Create map of absolute path -> file ID
        const fileIdMap = new Map<string, string>();
        this.filesWithZones.forEach(f => fileIdMap.set(f.filePath, f.id));

        try {
            const warnings = await analyzeArchitecture(targetPath, fileIdMap, { extensionPath: this.extensionPath });
            this.postMessage({
                type: 'setWarnings',
                data: warnings
            });
        } catch (err: any) {
            console.error('[Architecture] Analysis failed:', err);
            this.postMessage({
                type: 'architectureError',
                data: { message: `Architecture analysis failed: ${err.message || err}` }
            });
        }
    }

    private cleanup() {
        this.panel = null;
    }
}
