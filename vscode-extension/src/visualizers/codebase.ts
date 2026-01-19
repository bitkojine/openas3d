import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WorldVisualizer, VisualizerManifest } from './loader';

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
}

interface DependencyGraph {
    files: Map<string, CodeFile>;
    edges: Array<{ source: string; target: string; type: string }>;
}

export class CodebaseVisualizer implements WorldVisualizer {
    public manifest: VisualizerManifest = {
        name: 'Codebase Dependencies Visualizer',
        type: 'codebase',
        version: '1.0.0',
        languages: ['typescript', 'javascript', 'python', 'java', 'go'],
        description: 'Visualize code dependencies and architecture in 3D'
    };

    private panel: vscode.WebviewPanel | null = null;
    private dependencyGraph: DependencyGraph | null = null;

    // ───── Zones with closer grid layout ─────
    private zones: { [key: string]: { xStart: number; zStart: number; columns: number; spacing: number } } = {
        source: { xStart: -20, zStart: -10, columns: 8, spacing: 3 },
        docs: { xStart: -20, zStart: 10, columns: 8, spacing: 3 },
        configs: { xStart: 20, zStart: -10, columns: 6, spacing: 3 },
        build: { xStart: 20, zStart: 10, columns: 6, spacing: 3 },
        other: { xStart: -40, zStart: 30, columns: 5, spacing: 3 }
    };

    public async initialize(panel: vscode.WebviewPanel, data: { targetPath: string }): Promise<() => void> {
        this.panel = panel;

        try {
            console.log('Analyzing codebase at:', data.targetPath);

            const tAnalyze = performance.now();
            this.dependencyGraph = await this.analyzeCodebase(data.targetPath);
            console.log(`Codebase analysis completed in ${(performance.now() - tAnalyze).toFixed(2)}ms`);

            await this.visualizeDependencyGraph();

            console.log(`Visualized ${this.dependencyGraph.files.size} files with ${this.dependencyGraph.edges.length} dependencies`);
        } catch (error) {
            console.error('Error initializing codebase visualizer:', error);
            vscode.window.showErrorMessage(`Failed to analyze codebase: ${error}`);
        }

        return () => this.cleanup();
    }

    private async analyzeCodebase(rootPath: string): Promise<DependencyGraph> {
        const files = new Map<string, CodeFile>();
        const edges: Array<{ source: string; target: string; type: string }> = [];

        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const workspaceRoot = workspaceFolder?.uri.fsPath || rootPath;

        const tScan = performance.now();
        const sourceFiles = await this.findSourceFiles(rootPath);
        console.log(`Scanning ${sourceFiles.length} files took ${(performance.now() - tScan).toFixed(2)}ms`);

        for (const filePath of sourceFiles) {
            try {
                const tFile = performance.now();
                const fileInfo = await this.analyzeFile(filePath, workspaceRoot);
                console.log(`Analyzing ${filePath} took ${(performance.now() - tFile).toFixed(2)}ms`);

                if (fileInfo) files.set(fileInfo.id, fileInfo);
            } catch (error) {
                console.warn(`Failed to analyze file ${filePath}:`, error);
            }
        }

        for (const file of files.values()) {
            if (['typescript','javascript','python','java','go','csharp','cpp','c'].includes(file.language)) {
                for (const depPath of file.dependencies) {
                    const targetFile = this.findFileByPath(files, depPath, path.dirname(file.filePath));
                    if (targetFile) edges.push({ source: file.id, target: targetFile.id, type: 'import' });
                }
            }
        }

        return { files, edges };
    }

    private async findSourceFiles(rootPath: string): Promise<string[]> {
        const sourceFiles: string[] = [];

        const scanDirectory = async (dirPath: string): Promise<void> => {
            try {
                const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    if (entry.isDirectory()) {
                        if (!['node_modules', '.git', 'dist', 'build', 'out', '.vscode'].includes(entry.name)) {
                            await scanDirectory(fullPath);
                        }
                    } else if (entry.isFile()) {
                        sourceFiles.push(fullPath);
                    }
                }
            } catch (error) {
                console.warn(`Failed to scan directory ${dirPath}:`, error);
            }
        };

        await scanDirectory(rootPath);
        return sourceFiles;
    }

    private async analyzeFile(filePath: string, workspaceRoot: string): Promise<CodeFile | null> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf8');
            const stats = await fs.promises.stat(filePath);
            const relativePath = path.relative(workspaceRoot, filePath);
            const ext = path.extname(filePath);
            const language = this.getLanguageFromExtension(ext);
            const dependencies = ['typescript','javascript','python','java','go','csharp','cpp','c'].includes(language)
                ? this.extractDependencies(content, language)
                : [];
            const lines = content.split('\n').length;
            const complexity = ['typescript','javascript','python','java','go','csharp','cpp','c'].includes(language)
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
                lastModified: stats.mtime
            };
        } catch (error) {
            console.warn(`Failed to analyze file ${filePath}:`, error);
            return null;
        }
    }

    private getLanguageFromExtension(ext: string): string {
        const map: { [key: string]: string } = {
            '.ts': 'typescript', '.tsx': 'typescript',
            '.js': 'javascript', '.jsx': 'javascript',
            '.py': 'python', '.java': 'java',
            '.go': 'go', '.cs': 'csharp',
            '.cpp': 'cpp', '.c': 'c', '.h': 'c',
            '.md': 'markdown',
            '.json': 'json',
            '.yml': 'yaml', '.yaml': 'yaml',
            '.toml': 'toml'
        };
        return map[ext] || 'other';
    }

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

    private findFileByPath(files: Map<string, CodeFile>, depPath: string, currentDir: string): CodeFile | null {
        for (const file of files.values()) {
            if (file.relativePath.includes(depPath) ||
                path.basename(file.filePath, path.extname(file.filePath)) === depPath) return file;
        }
        return null;
    }

    private getZoneForFile(file: CodeFile): string {
        const ext = path.extname(file.filePath).toLowerCase();
        if (['.ts','.tsx','.js','.jsx','.py','.java','.go','.cs','.cpp','.c','.h'].includes(ext)) return 'source';
        if (['.md'].includes(ext)) return 'docs';
        if (['.json','.yaml','.yml','.toml'].includes(ext)) return 'configs';
        if (file.filePath.includes('dist') || file.filePath.includes('build') || file.filePath.includes('out')) return 'build';
        return 'other';
    }

    private getPositionInZone(file: CodeFile, indexInZone: number): { x: number; z: number } {
        const zoneName = this.getZoneForFile(file);
        const zone = this.zones[zoneName];
        const row = Math.floor(indexInZone / zone.columns);
        const col = indexInZone % zone.columns;
        const x = zone.xStart + col * zone.spacing;
        const z = zone.zStart + row * zone.spacing;
        return { x, z }; // Y handled in CodeObjectManager
    }

    private async visualizeDependencyGraph(): Promise<void> {
        if (!this.panel || !this.dependencyGraph) return;

        this.panel.webview.postMessage({ type: 'clear' });

        const zoneBuckets: { [key: string]: CodeFile[] } = {};
        Array.from(this.dependencyGraph.files.values()).forEach(file => {
            const zone = this.getZoneForFile(file);
            if (!zoneBuckets[zone]) zoneBuckets[zone] = [];
            zoneBuckets[zone].push(file);
        });

        for (const [zone, files] of Object.entries(zoneBuckets)) {
            files.forEach((file, i) => {
                const pos2D = this.getPositionInZone(file, i);

                // Compute width/depth/height based on size & lines
                const height = Math.min(0.25 + file.lines * 0.025, 5); // grow with lines
                const width = Math.min(1 + file.size / 1000, 3);
                const depth = Math.min(1 + file.size / 1000, 3);

                this.panel!.webview.postMessage({
                    type: 'addObject',
                    data: {
                        id: file.id,
                        type: 'file',
                        filePath: file.filePath,
                        position: { x: pos2D.x, y: 0, z: pos2D.z }, // Y handled in CodeObjectManager
                        size: { width, height, depth },
                        metadata: {
                            relativePath: file.relativePath,
                            language: file.language,
                            complexity: file.complexity,
                            size: file.size,
                            lines: file.lines,
                            lastModified: file.lastModified,
                            dependencies: file.dependencies.length
                        }
                    }
                });
            });
        }

        this.dependencyGraph.edges.forEach(edge => {
            this.panel!.webview.postMessage({
                type: 'addDependency',
                data: {
                    id: `${edge.source}-${edge.target}`,
                    source: edge.source,
                    target: edge.target,
                    type: edge.type,
                    color: this.getDependencyColor(edge.type),
                    opacity: 0.6
                }
            });
        });
    }

    private getDependencyColor(type: string): number {
        switch (type) {
            case 'import': return 0x00BFFF;
            case 'extends': return 0xFF6B35;
            case 'calls': return 0x32CD32;
            default: return 0x888888;
        }
    }

    private cleanup(): void {
        this.panel = null;
        this.dependencyGraph = null;
    }
}
