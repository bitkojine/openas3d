/**
 * PanelManager - Manages webview panel lifecycle only
 * 
 * Single Responsibility: Create, show, and dispose webview panels.
 * Does NOT handle messages, file watching, or any other concerns.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { generateWebviewHtml } from './webview-template';

export class PanelManager {
    private panel: vscode.WebviewPanel | undefined;
    private context: vscode.ExtensionContext;
    private version: string;

    constructor(context: vscode.ExtensionContext, version: string = '0.0.0') {
        this.context = context;
        this.version = version;
    }

    /**
     * Create a new panel or reveal existing one
     */
    public async createOrShowPanel(): Promise<vscode.WebviewPanel> {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (this.panel) {
            this.panel.reveal(columnToShowIn);
            return this.panel;
        }

        this.panel = vscode.window.createWebviewPanel(
            'openas3d-world',
            'OpenAs3D - 3D World',
            columnToShowIn || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(this.context.extensionPath, 'out')),
                    vscode.Uri.file(path.join(this.context.extensionPath, 'src', 'webview'))
                ]
            }
        );

        this.panel.webview.html = this.getWebviewContent();

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        }, null, this.context.subscriptions);

        return this.panel;
    }

    /**
     * Get the current panel (if any)
     */
    public getPanel(): vscode.WebviewPanel | undefined {
        return this.panel;
    }

    /**
     * Reveal the panel in the given column
     */
    public reveal(column?: vscode.ViewColumn, preserveFocus: boolean = false): void {
        this.panel?.reveal(column, preserveFocus);
    }

    /**
     * Dispose the panel
     */
    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }

    /**
     * Check if panel exists
     */
    public hasPanel(): boolean {
        return this.panel !== undefined;
    }

    private getWebviewContent(): string {
        if (!this.panel) {
            throw new Error('Panel must be created before getting content');
        }

        const jsPath = path.join(this.context.extensionPath, 'out', 'webview', 'renderer.js');
        const rendererUri = this.panel.webview.asWebviewUri(vscode.Uri.file(jsPath));

        return generateWebviewHtml(rendererUri, this.panel.webview.cspSource, this.version);
    }
}
