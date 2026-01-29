import * as vscode from 'vscode';
import { ExtensionMessage } from '../shared/messages';
import { EditorConfig } from '../shared/types';

/**
 * WorkspaceProxy - Interface to decouple service from global vscode singleton
 */
export interface WorkspaceProxy {
    getConfiguration(section: string): {
        get<T>(key: string, defaultValue?: T): T | undefined;
    };
    onDidChangeConfiguration: vscode.Event<vscode.ConfigurationChangeEvent>;
}

export class EditorConfigService {
    private sendUpdate: (message: ExtensionMessage) => void;
    private workspace: WorkspaceProxy;

    constructor(
        sendUpdate: (message: ExtensionMessage) => void,
        workspace: WorkspaceProxy = vscode.workspace
    ) {
        this.sendUpdate = sendUpdate;
        this.workspace = workspace;
    }

    /**
     * Start watching for config changes
     */
    public startWatching(context: vscode.ExtensionContext): void {
        // Send initial config
        this.sendEditorConfig();

        // Watch for changes
        const disposable = this.workspace.onDidChangeConfiguration(e => {
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
        const config = this.workspace.getConfiguration('editor');
        const fontSize = config.get<number>('fontSize', 14) || 14;
        const fontFamily = config.get<string>(
            'fontFamily',
            'Consolas, "Courier New", monospace'
        ) || 'Consolas, "Courier New", monospace';
        const lineHeight = config.get<number>('lineHeight', 0) || 0; // 0 means automatic

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
