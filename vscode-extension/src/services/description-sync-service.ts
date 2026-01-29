import * as vscode from 'vscode';
import * as path from 'path';
import { getLanguageDisplayName, getLanguageFromExtension } from '../utils/languageRegistry';
import { ExtensionMessage } from '../shared/messages';

export interface DescriptionUpdate {
    filePath: string;
    description: {
        summary: string;
        status: 'missing' | 'generated' | 'reconciled';
        lastUpdated?: string;
    };
}

/**
 * FileSystemProxy - Interface for decoupling file operations
 */
export interface FileSystemProxy {
    workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined;
    createFileSystemWatcher(pattern: vscode.RelativePattern): vscode.FileSystemWatcher;
    openTextDocument(uri: vscode.Uri): Promise<{ getText(): string }>;
    stat(uri: vscode.Uri): Promise<vscode.FileStat>;
}

export class DescriptionSyncService {
    private watcher: vscode.FileSystemWatcher | undefined;
    private sendUpdate: (message: ExtensionMessage) => void;
    private fsProxy: FileSystemProxy;

    constructor(
        sendUpdate: (message: ExtensionMessage) => void,
        fsProxy: FileSystemProxy = {
            workspaceFolders: vscode.workspace.workspaceFolders,
            createFileSystemWatcher: (p) => vscode.workspace.createFileSystemWatcher(p),
            openTextDocument: (u) => Promise.resolve(vscode.workspace.openTextDocument(u)),
            stat: (u) => Promise.resolve(vscode.workspace.fs.stat(u))
        }
    ) {
        this.sendUpdate = sendUpdate;
        this.fsProxy = fsProxy;
    }

    /**
     * Start watching for file changes
     */
    public startWatching(context: vscode.ExtensionContext): void {
        if (!this.fsProxy.workspaceFolders || this.fsProxy.workspaceFolders.length === 0) {
            return;
        }

        const pattern = new vscode.RelativePattern(
            this.fsProxy.workspaceFolders[0],
            '**/*'
        );
        this.watcher = this.fsProxy.createFileSystemWatcher(pattern);

        this.watcher.onDidCreate(uri => this.handleFileChange(uri));
        this.watcher.onDidChange(uri => this.handleFileChange(uri));
        this.watcher.onDidDelete(uri => this.handleFileDelete(uri));

        context.subscriptions.push(this.watcher);
    }

    /**
     * Stop watching
     */
    public stopWatching(): void {
        this.watcher?.dispose();
        this.watcher = undefined;
    }

    /**
     * Handle file creation or change
     */
    public async handleFileChange(uri: vscode.Uri): Promise<void> {
        try {
            const update = await this.extractDescription(uri);
            if (update) {
                this.sendUpdate({
                    type: 'updateObjectDescription',
                    data: update
                });
            }
        } catch (err) {
            console.error('Failed to read description file for update:', uri.fsPath, err);
        }
    }

    /**
     * Handle file deletion
     */
    public handleFileDelete(uri: vscode.Uri): void {
        this.sendUpdate({
            type: 'updateObjectDescription',
            data: {
                filePath: uri.fsPath,
                description: {
                    summary: 'No description yet.',
                    status: 'missing'
                }
            }
        });
    }

    /**
     * Extract description from a file
     */
    private async extractDescription(uri: vscode.Uri): Promise<DescriptionUpdate | null> {
        let summaryText = '';
        let status: 'missing' | 'generated' | 'reconciled' = 'missing';

        const isDescriptionFile = uri.fsPath.endsWith('.md');
        if (isDescriptionFile) {
            try {
                const doc = await this.fsProxy.openTextDocument(uri);
                const content = doc.getText();
                const summaryMatch = content.match(/## Summary\s+([\s\S]*?)(\n##|$)/i);
                summaryText = summaryMatch ? summaryMatch[1].trim() : '';
                const statusMatch = content.match(/status:\s*(\w+)/i);
                status = statusMatch ? (statusMatch[1] as any) : 'missing';
            } catch (e) {
                // File might not exist or be readable
            }
        }

        // If no summary from description file, try to generate from code file
        if (!summaryText) {
            const filePath = uri.fsPath.replace(/\.md$/, '');
            const codeUri = vscode.Uri.file(filePath);

            try {
                const stats = await this.fsProxy.stat(codeUri);
                const size = stats.size;
                let lastModified = 'Unknown';
                try {
                    lastModified = new Date(stats.mtime).toLocaleDateString('lt-LT', {
                        timeZone: 'Europe/Vilnius'
                    });
                } catch (e) {
                    lastModified = new Date(stats.mtime).toISOString();
                }
                const ext = path.extname(filePath);
                const language = getLanguageDisplayName(getLanguageFromExtension(ext)) || 'Unknown';
                const complexity = size / 50;

                summaryText = [
                    `Filename: ${path.basename(filePath)}`,
                    `Language: ${language}`,
                    `Size: ${size.toLocaleString('lt-LT')} bytes`,
                    `Complexity: ${Math.round(complexity)}`,
                    `Last Modified: ${lastModified}`
                ].join('\n');

                status = 'generated';
            } catch (e) {
                summaryText = 'No description available';
            }
        }

        return {
            filePath: uri.fsPath,
            description: {
                summary: summaryText,
                status
            }
        };
    }
}
