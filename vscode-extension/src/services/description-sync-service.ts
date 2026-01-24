/**
 * DescriptionSyncService - Watches files and syncs descriptions to webview
 * 
 * Single Responsibility: File system watching and description file updates.
 * Watches for .md description files and code files, extracts summaries,
 * and sends updates to the webview.
 */

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

export class DescriptionSyncService {
    private watcher: vscode.FileSystemWatcher | undefined;
    private sendUpdate: (message: ExtensionMessage) => void;

    constructor(sendUpdate: (message: ExtensionMessage) => void) {
        this.sendUpdate = sendUpdate;
    }

    /**
     * Start watching for file changes
     */
    public startWatching(context: vscode.ExtensionContext): void {
        if (!vscode.workspace.workspaceFolders) {
            return;
        }

        const pattern = new vscode.RelativePattern(
            vscode.workspace.workspaceFolders[0],
            '**/*'
        );
        this.watcher = vscode.workspace.createFileSystemWatcher(pattern);

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
    private async handleFileChange(uri: vscode.Uri): Promise<void> {
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
    private handleFileDelete(uri: vscode.Uri): void {
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
        let content = '';
        let summaryText = '';
        let status: 'missing' | 'generated' | 'reconciled' = 'missing';

        const isDescriptionFile = uri.fsPath.endsWith('.md');
        if (isDescriptionFile) {
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                content = doc.getText();
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
                const stats = await vscode.workspace.fs.stat(codeUri);
                const size = stats.size;
                const lastModified = new Date(stats.mtime).toLocaleDateString('lt-LT', {
                    timeZone: 'Europe/Vilnius'
                });
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
