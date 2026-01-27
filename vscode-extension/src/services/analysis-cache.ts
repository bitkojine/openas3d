import * as vscode from 'vscode';
import { CodeFile, DependencyEdge } from '../core/domain/code-file';

export interface CachedGraph {
    files: CodeFile[];
    edges: DependencyEdge[];
    rootPath: string;
    timestamp: number;
}

export class AnalysisCacheService {
    private static readonly CACHE_KEY = 'openas3d.analysisCache';

    constructor(private context: vscode.ExtensionContext) { }

    /**
     * Store the analysis results in the workspace state.
     */
    public async setCache(rootPath: string, files: CodeFile[], edges: DependencyEdge[]): Promise<void> {
        const cache: CachedGraph = {
            files,
            edges,
            rootPath,
            timestamp: Date.now()
        };
        const sizeString = JSON.stringify(cache);
        await this.context.workspaceState.update(AnalysisCacheService.CACHE_KEY, cache);
        console.log(`[AnalysisCacheService] Cached ${files.length} files and ${edges.length} edges for ${rootPath} (Size: ${(sizeString.length / 1024).toFixed(1)} KB)`);
    }

    /**
     * Retrieve the analysis results from the workspace state.
     */
    public getCache(rootPath: string): CachedGraph | undefined {
        const cache = this.context.workspaceState.get<CachedGraph>(AnalysisCacheService.CACHE_KEY);

        if (!cache) return undefined;

        // Ensure the cache is for the same root path
        if (cache.rootPath !== rootPath) {
            console.log(`[AnalysisCacheService] Cache miss: path mismatch (expected ${rootPath}, got ${cache.rootPath})`);
            return undefined;
        }

        // Handle Date restoration if necessary (though CodeFile uses lastModified: Date)
        // Note: workspaceState.get returns basic objects, so we might need to convert strings back to Dates
        cache.files.forEach(f => {
            if (typeof f.lastModified === 'string') {
                f.lastModified = new Date(f.lastModified);
            }
        });

        console.log(`[AnalysisCacheService] Cache hit: found ${cache.files.length} files for ${rootPath}`);
        return cache;
    }

    /**
     * Clear the cache.
     */
    public async clearCache(): Promise<void> {
        await this.context.workspaceState.update(AnalysisCacheService.CACHE_KEY, undefined);
        console.log('[AnalysisCacheService] Cache cleared');
    }
}
