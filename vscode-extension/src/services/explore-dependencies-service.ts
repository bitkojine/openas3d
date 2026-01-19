// services/explore-dependencies-service.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { WebviewPanelManager } from '../webview/panel';
import { ExtensionLoader } from '../visualizers/loader';
import { PerfTracker } from '../utils/perf-tracker';

export class ExploreDependenciesService {
    constructor(
        private panelManager: WebviewPanelManager,
        private loader: ExtensionLoader,
        private perf: PerfTracker
    ) {}

    /** Handle the "Explore Dependencies" command */
    public async exploreDependencies(uri?: vscode.Uri) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showWarningMessage('Please open a workspace folder to explore dependencies.');
            return;
        }

        const targetPath = uri?.fsPath || workspaceFolder.uri.fsPath;

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing codebase dependencies...',
            cancellable: false
        }, async (progress) => {
            progress.report({ increment: 0, message: 'Initializing 3D world...' });

            // ───── Create or reveal the panel ─────
            const tPanel = this.perf.start('createOrShowPanel');
            const panel = await this.panelManager.createOrShowPanel();
            this.perf.stop('createOrShowPanel', tPanel);

            // Listen for sign placement messages
            panel.webview.onDidReceiveMessage(async (message) => {
                if (message.type === 'addSignAtPosition') {
                    // Delegate to SignService later
                    vscode.window.showInformationMessage('Sign placement received.');
                }
            });

            // Live performance reporting
            this.perf.setUICallback(report => {
                this.panelManager.sendMessage({
                    type: 'perfUpdate',
                    data: { report }
                });
            });

            progress.report({ increment: 50, message: 'Loading codebase visualizer...' });

            // ───── Load codebase visualizer ─────
            const tVisualizer = this.perf.start('loadCodebaseVisualizer');
            await this.loader.loadCodebaseVisualizer(panel, targetPath);
            this.perf.stop('loadCodebaseVisualizer', tVisualizer);

            progress.report({ increment: 100, message: 'Complete!' });
            this.perf.report();
        });
    }

    /** Handle the "Open 3D World" command (without a URI) */
    public async open3DWorld() {
        await this.exploreDependencies();
    }
}
