import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CodeFile, DependencyEdge } from './types';
import { getLanguageFromExtension, isCodeLanguage } from '../utils/languageRegistry';

/** Maximum number of lines to send to the webview for textures */
const MAX_CONTENT_LINES = 100;

/**
 * Responsible for scanning files and extracting dependency information.
 * Supports streaming analysis for progressive UI updates.
 */
export class CodebaseAnalyzer {
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

    /**
     * Analyze a single file and extract its metadata
     */
    public async analyzeFile(filePath: string): Promise<CodeFile | null> {
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

    /**
     * Extract import/require dependencies from file content
     */
    public extractDependencies(content: string, language: string): string[] {
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

    /**
     * Calculate a simple complexity score based on control flow statements
     */
    public calculateComplexity(content: string): number {
        const lines = content.split('\n').filter(l => l.trim().length > 0);
        const control = (content.match(/\b(if|for|while|switch|try|catch)\b/g) || []).length;
        return lines.length + control * 2;
    }

    /**
     * Generate a unique ID for a file based on its relative path
     */
    public generateFileId(relativePath: string): string {
        return relativePath.replace(/[^a-zA-Z0-9]/g, '_');
    }

    /**
     * Find a file in the analyzed set by its dependency path
     */
    public findFileByPath(files: Map<string, CodeFile>, depPath: string): CodeFile | null {
        for (const file of files.values()) {
            if (file.relativePath.includes(depPath) ||
                path.basename(file.filePath, path.extname(file.filePath)) === depPath) return file;
        }
        return null;
    }
}
