import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorldVisualizer, VisualizerManifest } from './loader';
import { getLanguageFromExtension, isCodeLanguage } from '../utils/languageRegistry';

interface CodeFile {
    id: string;
    filePath: string;
    relativePath: string;
    language: string;
    size: number;
    lines: number;
    dependencies: string[];
    complexity?: number;
    lastModified: Date;
    content: string; // truncated content for textures
}

interface DependencyEdge {
    source: string;
    target: string;
    type: string;
}

interface DependencyGraph {
    files: Map<string, CodeFile>;
    edges: DependencyEdge[];
}

/** Maximum number of lines to send to the webview for textures */
const MAX_CONTENT_LINES = 100;

/**
 * Responsible for scanning files and extracting dependency information.
 */
class CodebaseAnalyzer {
    private workspaceRoot: string;

    constructor(rootPath: string) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        this.workspaceRoot = workspaceFolder?.uri.fsPath || rootPath;
    }

    /**
     * Stream files as they're discovered and analyzed.
     * Calls onFile callback for each file, allowing progressive rendering.
     */
    public async analyzeStreaming(
        onFile: (file: CodeFile) => void,
        onComplete: (edges: DependencyEdge[]) => void
    ): Promise<void> {
        const files = new Map<string, CodeFile>();

        // Use setImmediate to not block the event loop
        const yieldToEventLoop = () => new Promise(resolve => setImmediate(resolve));

        const processDirectory = async (dirPath: string): Promise<void> => {
            try {
                const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });

                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);

                    if (entry.isDirectory()) {
                        if (!['node_modules', '.git', 'dist', 'build', 'out', '.vscode'].includes(entry.name)) {
                            await processDirectory(fullPath);
                        }
                    } else if (entry.isFile()) {
                        const fileInfo = await this.analyzeFile(fullPath);
                        if (fileInfo) {
                            files.set(fileInfo.id, fileInfo);
                            onFile(fileInfo); // Stream file immediately
                        }
                        // Yield every few files to keep UI responsive
                        if (files.size % 5 === 0) {
                            await yieldToEventLoop();
                        }
                    }
                }
            } catch (error) {
                console.warn(`Failed to scan directory ${dirPath}:`, error);
            }
        };

        await processDirectory(this.workspaceRoot);

        // Build dependency edges after all files are loaded
        const edges: DependencyEdge[] = [];
        for (const file of files.values()) {
            if (isCodeLanguage(file.language)) {
                for (const depPath of file.dependencies) {
                    const targetFile = this.findFileByPath(files, depPath);
                    if (targetFile) {
                        edges.push({ source: file.id, target: targetFile.id, type: 'import' });
                    }
                }
            }
        }

        onComplete(edges);
    }

    private async analyzeFile(filePath: string): Promise<CodeFile | null> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');

            // Cache the line split to avoid duplicate operations
            const allLines = content.split('\n');
            const truncatedContent = allLines.slice(0, MAX_CONTENT_LINES).join('\n');

            const stats = await fs.promises.stat(filePath);
            const relativePath = path.relative(this.workspaceRoot, filePath);
            const ext = path.extname(filePath);
            const language = getLanguageFromExtension(ext);

            // Only search first 50 lines for imports (they're typically at top)
            const importSection = allLines.slice(0, 50).join('\n');
            const dependencies = isCodeLanguage(language)
                ? this.extractDependencies(importSection, language)
                : [];
            const lines = allLines.length;
            const complexity = isCodeLanguage(language)
                ? this.calculateComplexity(content)
                : undefined;

            return {
                id: this.generateFileId(relativePath),
                filePath,
                relativePath,
                language,
                size: stats.size,
                lines,
                dependencies,
                complexity,
                lastModified: stats.mtime,
                content: truncatedContent
            };
        } catch (error) {
            console.warn(`Failed to analyze file ${filePath}:`, error);
            return null;
        }
    }

    // getLanguageFromExtension moved to languageRegistry.ts

    private extractDependencies(content: string, language: string): string[] {
        const deps: string[] = [];
        let match;

        switch (language) {
            case 'typescript':
            case 'javascript':
                const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
                const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
                while ((match = importRegex.exec(content))) deps.push(match[1]);
                while ((match = requireRegex.exec(content))) deps.push(match[1]);
                break;

            case 'python':
                const pyRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
                while ((match = pyRegex.exec(content))) deps.push(match[1] || match[2]);
                break;

            case 'java':
                const javaRegex = /import\s+([^;]+);/g;
                while ((match = javaRegex.exec(content))) deps.push(match[1]);
                break;

            case 'go':
                const goRegex = /import\s+(?:\(\s*([^)]+)\s*\)|"([^"]+)")/g;
                while ((match = goRegex.exec(content))) {
                    if (match[1]) deps.push(...match[1].split('\n').map(l => l.trim().replace(/"/g, '')).filter(Boolean));
                    else deps.push(match[2]);
                }
                break;
        }

        return deps.filter(d => d && !d.startsWith('.') && !d.startsWith('/'));
    }

    private calculateComplexity(content: string): number {
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        const control = (content.match(/\b(if|for|while|switch|try|catch)\b/g) || []).length;
        return lines.length + control * 2;
    }

    private generateFileId(relativePath: string): string {
        return relativePath.replace(/[^a-zA-Z0-9]/g, '_');
    }

    private findFileByPath(files: Map<string, CodeFile>, depPath: string): CodeFile | null {
        for (const file of files.values()) {
            if (file.relativePath.includes(depPath) ||
                path.basename(file.filePath, path.extname(file.filePath)) === depPath) return file;
        }
        return null;
    }
}

/**
 * Responsible for computing 3D layout positions for files
 */
export class CodebaseLayoutEngine {
    private zones: { [key: string]: { xStart: number; zStart: number; columns: number; spacing: number } } = {
        source: { xStart: -20, zStart: -10, columns: 8, spacing: 3 },
        docs: { xStart: -20, zStart: 10, columns: 8, spacing: 3 },
        configs: { xStart: 20, zStart: -10, columns: 6, spacing: 3 },
        build: { xStart: 20, zStart: 10, columns: 6, spacing: 3 },
        other: { xStart: -40, zStart: 30, columns: 5, spacing: 3 }
    };

    public computePositions(files: CodeFile[]): Map<string, { x: number; z: number }> {
        const zoneBuckets: { [zone: string]: CodeFile[] } = {};

        files.forEach(file => {
            const zone = this.getZoneForFile(file);
            if (!zoneBuckets[zone]) zoneBuckets[zone] = [];
            zoneBuckets[zone].push(file);
        });

        const positions = new Map<string, { x: number; z: number }>();
        Object.entries(zoneBuckets).forEach(([zone, filesInZone]) => {
            filesInZone.forEach((file, i) => {
                const pos = this.getPositionForZone(zone, i);
                positions.set(file.id, pos);
            });
        });

        return positions;
    }

    private getZoneForFile(file: CodeFile): string {
        const ext = path.extname(file.filePath).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.csharp', '.cpp', '.c', '.h'].includes(ext)) return 'source';
        if (['.md'].includes(ext)) return 'docs';
        if (['.json', '.yaml', '.yml', '.toml'].includes(ext)) return 'configs';
        if (file.filePath.includes('dist') || file.filePath.includes('build') || file.filePath.includes('out')) return 'build';
        return 'other';
    }

    public getPositionForZone(zoneName: string, indexInZone: number): { x: number; z: number } {
        const zone = this.zones[zoneName] || this.zones['other'];
        const row = Math.floor(indexInZone / zone.columns);
        const col = indexInZone % zone.columns;
        const x = zone.xStart + col * zone.spacing;
        const z = zone.zStart + row * zone.spacing;
        return { x, z };
    }
}

/**
 * Facade class for the VSCode extension loader
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
        const zone = this.getZoneForFile(file);
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

    private getZoneForFile(file: CodeFile): string {
        const ext = path.extname(file.filePath).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.csharp', '.cpp', '.c', '.h'].includes(ext)) return 'source';
        if (['.md'].includes(ext)) return 'docs';
        if (['.json', '.yaml', '.yml', '.toml'].includes(ext)) return 'configs';
        if (file.filePath.includes('dist') || file.filePath.includes('build') || file.filePath.includes('out')) return 'build';
        return 'other';
    }

    private cleanup() {
        this.panel = null;
    }
}
