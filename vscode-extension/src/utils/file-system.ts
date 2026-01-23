import * as vscode from 'vscode';
import * as path from 'path';
import { getLanguageFromExtension } from './languageRegistry';

export class FileSystemHelper {
    /**
     * Get all files in a directory recursively with filtering
     */
    public static async getFilesRecursively(
        dirUri: vscode.Uri,
        extensions: string[] = [],
        excludePatterns: string[] = ['node_modules', '.git', 'dist', 'build', 'out']
    ): Promise<vscode.Uri[]> {
        const files: vscode.Uri[] = [];

        try {
            const entries = await vscode.workspace.fs.readDirectory(dirUri);

            for (const [name, type] of entries) {
                const entryUri = vscode.Uri.joinPath(dirUri, name);

                if (type === vscode.FileType.Directory) {
                    // Skip excluded directories
                    if (!excludePatterns.includes(name)) {
                        const subFiles = await this.getFilesRecursively(entryUri, extensions, excludePatterns);
                        files.push(...subFiles);
                    }
                } else if (type === vscode.FileType.File) {
                    // Check if file has allowed extension
                    if (extensions.length === 0 || extensions.includes(path.extname(name))) {
                        files.push(entryUri);
                    }
                }
            }
        } catch (error) {
            console.warn(`Failed to read directory ${dirUri.fsPath}:`, error);
        }

        return files;
    }

    /**
     * Read file content as string
     */
    public static async readFileContent(fileUri: vscode.Uri): Promise<string> {
        try {
            const content = await vscode.workspace.fs.readFile(fileUri);
            return Buffer.from(content).toString('utf8');
        } catch (error) {
            throw new Error(`Failed to read file ${fileUri.fsPath}: ${error}`);
        }
    }

    /**
     * Get file statistics
     */
    public static async getFileStat(fileUri: vscode.Uri): Promise<vscode.FileStat> {
        try {
            return await vscode.workspace.fs.stat(fileUri);
        } catch (error) {
            throw new Error(`Failed to get file stats for ${fileUri.fsPath}: ${error}`);
        }
    }

    /**
     * Check if file exists
     */
    public static async fileExists(fileUri: vscode.Uri): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(fileUri);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Get relative path from workspace root
     */
    public static getRelativePath(fileUri: vscode.Uri): string {
        const workspaceFolder = vscode.workspace.getWorkspaceFolder(fileUri);
        if (workspaceFolder) {
            return path.relative(workspaceFolder.uri.fsPath, fileUri.fsPath);
        }
        return fileUri.fsPath;
    }

    /**
     * Get workspace folder for a file
     */
    public static getWorkspaceFolder(fileUri: vscode.Uri): vscode.WorkspaceFolder | undefined {
        return vscode.workspace.getWorkspaceFolder(fileUri);
    }

    /**
     * Get all workspace folders
     */
    public static getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] {
        return vscode.workspace.workspaceFolders || [];
    }

    /**
     * Open file in editor
     */
    public static async openFileInEditor(fileUri: vscode.Uri, line?: number, column?: number): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(document);

            if (line !== undefined) {
                const position = new vscode.Position(line, column || 0);
                editor.selection = new vscode.Selection(position, position);
                editor.revealRange(new vscode.Range(position, position));
            }
        } catch (error) {
            throw new Error(`Failed to open file ${fileUri.fsPath}: ${error}`);
        }
    }
}