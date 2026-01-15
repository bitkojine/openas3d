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

    public async initialize(panel: vscode.WebviewPanel, data: { targetPath: string }): Promise<() => void> {
        this.panel = panel;
        
        try {
            // Analyze the codebase
            console.log('Analyzing codebase at:', data.targetPath);
            this.dependencyGraph = await this.analyzeCodebase(data.targetPath);
            
            // Visualize the dependency graph
            await this.visualizeDependencyGraph();
            
            console.log(`Visualized ${this.dependencyGraph.files.size} files with ${this.dependencyGraph.edges.length} dependencies`);
            
        } catch (error) {
            console.error('Error initializing codebase visualizer:', error);
            vscode.window.showErrorMessage(`Failed to analyze codebase: ${error}`);
        }

        // Return cleanup function
        return () => {
            this.cleanup();
        };
    }

    private async analyzeCodebase(rootPath: string): Promise<DependencyGraph> {
        const files = new Map<string, CodeFile>();
        const edges: Array<{ source: string; target: string; type: string }> = [];

        // Get workspace folder for relative path calculation
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        const workspaceRoot = workspaceFolder?.uri.fsPath || rootPath;

        // Find all source code files
        const sourceFiles = await this.findSourceFiles(rootPath);
        
        // Analyze each file
        for (const filePath of sourceFiles) {
            try {
                const fileInfo = await this.analyzeFile(filePath, workspaceRoot);
                if (fileInfo) {
                    files.set(fileInfo.id, fileInfo);
                }
            } catch (error) {
                console.warn(`Failed to analyze file ${filePath}:`, error);
            }
        }

        // Build dependency edges
        for (const file of files.values()) {
            for (const depPath of file.dependencies) {
                const targetFile = this.findFileByPath(files, depPath, path.dirname(file.filePath));
                if (targetFile) {
                    edges.push({
                        source: file.id,
                        target: targetFile.id,
                        type: 'import'
                    });
                }
            }
        }

        return { files, edges };
    }

    private async findSourceFiles(rootPath: string): Promise<string[]> {
        const sourceFiles: string[] = [];
        const supportedExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.cs', '.cpp', '.c', '.h'];

        const scanDirectory = async (dirPath: string): Promise<void> => {
            try {
                const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
                
                for (const entry of entries) {
                    const fullPath = path.join(dirPath, entry.name);
                    
                    if (entry.isDirectory()) {
                        // Skip common directories that don't contain source code
                        if (!['node_modules', '.git', 'dist', 'build', 'out', '.vscode'].includes(entry.name)) {
                            await scanDirectory(fullPath);
                        }
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name);
                        if (supportedExtensions.includes(ext)) {
                            sourceFiles.push(fullPath);
                        }
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
            
            // Determine language
            const language = this.getLanguageFromExtension(ext);
            
            // Extract dependencies (simple regex-based approach)
            const dependencies = this.extractDependencies(content, language);
            
            // Calculate basic complexity (lines of code as a simple metric)
            const complexity = this.calculateComplexity(content);

            return {
                id: this.generateFileId(relativePath),
                filePath,
                relativePath,
                language,
                size: stats.size,
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
        const languageMap: { [key: string]: string } = {
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.py': 'python',
            '.java': 'java',
            '.go': 'go',
            '.cs': 'csharp',
            '.cpp': 'cpp',
            '.c': 'c',
            '.h': 'c'
        };
        return languageMap[ext] || 'unknown';
    }

    private extractDependencies(content: string, language: string): string[] {
        const dependencies: string[] = [];
        
        switch (language) {
            case 'typescript':
            case 'javascript':
                // Match import statements
                const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
                const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
                
                let match;
                while ((match = importRegex.exec(content)) !== null) {
                    dependencies.push(match[1]);
                }
                while ((match = requireRegex.exec(content)) !== null) {
                    dependencies.push(match[1]);
                }
                break;
                
            case 'python':
                // Match import statements
                const pythonImportRegex = /(?:from\s+(\S+)\s+import|import\s+(\S+))/g;
                while ((match = pythonImportRegex.exec(content)) !== null) {
                    dependencies.push(match[1] || match[2]);
                }
                break;
                
            case 'java':
                // Match import statements
                const javaImportRegex = /import\s+([^;]+);/g;
                while ((match = javaImportRegex.exec(content)) !== null) {
                    dependencies.push(match[1]);
                }
                break;
                
            case 'go':
                // Match import statements
                const goImportRegex = /import\s+(?:\(\s*([^)]+)\s*\)|"([^"]+)")/g;
                while ((match = goImportRegex.exec(content)) !== null) {
                    if (match[1]) {
                        // Multi-line import
                        const imports = match[1].split('\n').map(line => line.trim().replace(/"/g, '')).filter(Boolean);
                        dependencies.push(...imports);
                    } else {
                        dependencies.push(match[2]);
                    }
                }
                break;
        }
        
        return dependencies.filter(dep => dep && !dep.startsWith('.') && !dep.startsWith('/'));
    }

    private calculateComplexity(content: string): number {
        // Simple complexity metric based on lines of code and control structures
        const lines = content.split('\n').filter(line => line.trim().length > 0);
        const controlStructures = (content.match(/\b(if|for|while|switch|try|catch)\b/g) || []).length;
        
        return lines.length + (controlStructures * 2);
    }

    private generateFileId(relativePath: string): string {
        return relativePath.replace(/[^a-zA-Z0-9]/g, '_');
    }

    private findFileByPath(files: Map<string, CodeFile>, depPath: string, currentDir: string): CodeFile | null {
        // Try to resolve the dependency path to an actual file
        for (const file of files.values()) {
            if (file.relativePath.includes(depPath) || 
                path.basename(file.filePath, path.extname(file.filePath)) === depPath) {
                return file;
            }
        }
        return null;
    }

    private async visualizeDependencyGraph(): Promise<void> {
        if (!this.panel || !this.dependencyGraph) {
            return;
        }

        // Clear existing objects
        this.panel.webview.postMessage({ type: 'clear' });

        const files = Array.from(this.dependencyGraph.files.values());
        const maxComplexity = Math.max(...files.map(f => f.complexity || 0));
        
        // Position files in a grid layout with some clustering
        const gridSize = Math.ceil(Math.sqrt(files.length));
        const spacing = 5;

        files.forEach((file, index) => {
            const x = (index % gridSize) * spacing - (gridSize * spacing) / 2;
            const z = Math.floor(index / gridSize) * spacing - (gridSize * spacing) / 2;
            const y = 0.5; // Base height

            // Color based on language
            const color = this.getLanguageColor(file.language);
            
            // Size based on complexity
            const complexityRatio = (file.complexity || 0) / maxComplexity;
            const height = 0.5 + complexityRatio * 2;
            const width = 0.8 + complexityRatio * 0.4;

            this.panel!.webview.postMessage({
                type: 'addObject',
                data: {
                    id: file.id,
                    type: 'file',
                    filePath: file.filePath,
                    position: { x, y: height / 2, z },
                    color,
                    size: { width, height, depth: width },
                    metadata: {
                        relativePath: file.relativePath,
                        language: file.language,
                        complexity: file.complexity,
                        size: file.size,
                        dependencies: file.dependencies.length
                    }
                }
            });
        });

        // TODO: Add dependency edges as lines between objects
        // This would require extending the renderer to support line objects
    }

    private getLanguageColor(language: string): number {
        const colorMap: { [key: string]: number } = {
            'typescript': 0x3178C6,
            'javascript': 0xF7DF1E,
            'python': 0x3776AB,
            'java': 0xED8B00,
            'go': 0x00ADD8,
            'csharp': 0x239120,
            'cpp': 0x00599C,
            'c': 0x555555,
            'unknown': 0x888888
        };
        return colorMap[language] || colorMap['unknown'];
    }

    private cleanup(): void {
        this.panel = null;
        this.dependencyGraph = null;
    }
}