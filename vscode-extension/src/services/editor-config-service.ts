/**
 * EditorConfigService - Syncs editor configuration to webview
 * 
 * Single Responsibility: Watch editor config changes and send updates to webview.
 */

import * as vscode from 'vscode';
import { ExtensionMessage } from '../shared/messages';
import { EditorConfig } from '../shared/types';

export class EditorConfigService {
    private sendUpdate: (message: ExtensionMessage) => void;

    constructor(sendUpdate: (message: ExtensionMessage) => void) {
        this.sendUpdate = sendUpdate;
    }

    /**
     * Start watching for config changes
     */
    public startWatching(context: vscode.ExtensionContext): void {
        // Send initial config
        this.sendEditorConfig();

        // Watch for changes
        const disposable = vscode.workspace.onDidChangeConfiguration(e => {
            if (
                e.affectsConfiguration('editor.fontSize') ||
                e.affectsConfiguration('editor.fontFamily') ||
                e.affectsConfiguration('editor.lineHeight')
            ) {
                this.sendEditorConfig();
            }
        });

        context.subscriptions.push(disposable);
    }

    /**
     * Send current editor config to webview
     */
    private sendEditorConfig(): void {
        const config = vscode.workspace.getConfiguration('editor');
        const fontSize = config.get<number>('fontSize', 14);
        const fontFamily = config.get<string>(
            'fontFamily',
            'Consolas, "Courier New", monospace'
        );
        const lineHeight = config.get<number>('lineHeight', 0); // 0 means automatic

        this.sendUpdate({
            type: 'updateConfig',
            data: {
                fontSize,
                fontFamily,
                lineHeight: lineHeight || fontSize * 1.5 // Fallback if 0
            }
        });
    }
}
