/**
 * PanelManager - Manages webview panel lifecycle only
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { generateWebviewHtml } from './webview-template';

export class PanelManager implements vscode.WebviewPanelSerializer {
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
    public async createOrShowPanel(): Promise<{ panel: vscode.WebviewPanel, created: boolean }> {
        const columnToShowIn = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (this.panel) {
            this.panel.reveal(columnToShowIn);
            return { panel: this.panel, created: false };
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

        this.panel.onDidDispose(() => {
            this.panel = undefined;
        }, null, this.context.subscriptions);

        return { panel: this.panel, created: true };
    }

    /**
     * Implementation of WebviewPanelSerializer
     */
    public async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel, _state: any) {
        this.panel = webviewPanel;
        this.panel.onDidDispose(() => {
            this.panel = undefined;
        }, null, this.context.subscriptions);
    }

    public getPanel(): vscode.WebviewPanel | undefined {
        return this.panel;
    }

    public reveal(column?: vscode.ViewColumn, preserveFocus: boolean = false): void {
        this.panel?.reveal(column, preserveFocus);
    }

    public dispose(): void {
        if (this.panel) {
            this.panel.dispose();
            this.panel = undefined;
        }
    }

    public hasPanel(): boolean {
        return this.panel !== undefined;
    }

    public getWebviewContent(): string {
        if (!this.panel) {
            throw new Error('Panel must be created before getting content');
        }

        const jsPath = path.join(this.context.extensionPath, 'out', 'webview', 'renderer.js');
        const rendererUri = this.panel.webview.asWebviewUri(vscode.Uri.file(jsPath));

        return generateWebviewHtml(rendererUri, this.panel.webview.cspSource, this.version);
    }
}
