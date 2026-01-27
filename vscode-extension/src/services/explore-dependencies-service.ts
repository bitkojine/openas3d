// services/explore-dependencies-service.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { WebviewPanelManager } from '../webview/panel';
import { CodebaseVisualizer } from '../visualizers/codebase';
import { PerfTracker } from '../utils/perf-tracker';
import { SignService } from './sign-service';
import { DevManagerV2 } from './dev-manager-v2';

// New architecture imports
import { StateManager, StateConfig } from '../core/state-manager';

export class ExploreDependenciesService {
    constructor(
        private panelManager: WebviewPanelManager,
        private visualizer: CodebaseVisualizer,
        private perf: PerfTracker,
        private signService: SignService,
        private context: vscode.ExtensionContext,
        private stateManager?: StateManager
    ) { }

    private static readonly REOPEN_STATE_KEY = 'openas3d.reopenWorldPath';
    private static readonly WORLD_STATE_KEY = 'openas3d.worldState';

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
            const totalStart = Date.now();
            console.log(`[ExploreDependenciesService] Starting exploreDependencies for: ${targetPath}`);
            console.time('[ExploreDependenciesService] Total Load Time');

            progress.report({ increment: 0, message: 'Initializing 3D world...' });

            // ───── Create or reveal the panel ─────
            const tPanel = this.perf.start('ExploreDependenciesService.createOrShowPanel');
            const panel = await this.panelManager.createOrShowPanel();
            this.perf.stop('ExploreDependenciesService.createOrShowPanel', tPanel);

            // Persist state for restoration using new StateManager if available
            if (this.stateManager) {
                await this.stateManager.saveState({
                    key: ExploreDependenciesService.REOPEN_STATE_KEY,
                    scope: 'workspace'
                }, targetPath);
            } else {
                // Fallback to old method
                this.context.workspaceState.update(ExploreDependenciesService.REOPEN_STATE_KEY, targetPath);
            }
            
            panel.onDidDispose(() => {
                const isReloading = this.context.globalState.get(DevManagerV2.RELOADING_FLAG);
                if (!isReloading) {
                    if (this.stateManager) {
                        this.stateManager.saveState({
                            key: ExploreDependenciesService.REOPEN_STATE_KEY,
                            scope: 'workspace'
                        }, undefined);
                    } else {
                        this.context.workspaceState.update(ExploreDependenciesService.REOPEN_STATE_KEY, undefined);
                    }
                }
            });

            // Register sign handler
            this.panelManager.registerSignHandler(this.signService);

            // Register World State handler
            this.panelManager.register('updateWorldState', async (state: import('../shared/messages').WorldStatePayload) => {
                if (this.stateManager) {
                    await this.stateManager.saveState({
                        key: ExploreDependenciesService.WORLD_STATE_KEY,
                        scope: 'workspace'
                    }, state);
                } else {
                    // Fallback to old method
                    await this.context.workspaceState.update(ExploreDependenciesService.WORLD_STATE_KEY, state);
                }
            });

            // Ensure webview is ready before sending large data streams
            // Wrap in timeout to prevent hanging if 'ready' message is missed
            try {
                const readyStart = Date.now();
                await Promise.race([
                    this.panelManager.ensureReady(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for webview ready')), 5000))
                ]);
                console.log(`[ExploreDependenciesService] Webview ready in ${Date.now() - readyStart}ms`);
            } catch (e) {
                console.warn('[ExploreDependenciesService] ensureReady timing out or failed, proceeding anyway...');
            }

            // Restore World State if available
            // Note: We send this even if savedState is undefined to signal "restoration check done"
            let savedState;
            if (this.stateManager) {
                savedState = await this.stateManager.loadState({
                    key: ExploreDependenciesService.WORLD_STATE_KEY,
                    scope: 'workspace'
                });
            } else {
                // Fallback to old method
                savedState = this.context.workspaceState.get(ExploreDependenciesService.WORLD_STATE_KEY);
            }
            
            console.log(`[ExploreDependenciesService] World state restoration check: ${savedState ? 'Found saved state' : 'No saved state'}`);
            if (savedState) {
                const s = savedState as any;
                console.log(`[ExploreDependenciesService] Saved Player Pos: ${s.player?.position?.x}, ${s.player?.position?.y}, ${s.player?.position?.z}`);
            }
            this.panelManager.sendMessage({
                type: 'restoreWorldState',
                data: (savedState || null) as any
            });

            // Live performance reporting
            this.perf.setUICallback(stats => {
                this.panelManager.sendMessage({
                    type: 'perfUpdate',
                    data: { stats }
                });
            });

            progress.report({ increment: 50, message: 'Loading codebase visualizer...' });

            // ───── Load codebase visualizer ─────
            const tVisualizer = this.perf.start('ExploreDependenciesService.loadCodebaseVisualizer');
            // FIX: call visualizer.initialize directly
            // We need to manage the cleanup function returned by initialize if we want to be correct, 
            // but for now let's just await it.
            await this.visualizer.initialize(panel, { targetPath });
            this.perf.stop('ExploreDependenciesService.loadCodebaseVisualizer', tVisualizer);

            progress.report({ increment: 100, message: 'Complete!' });
            console.timeEnd('[ExploreDependenciesService] Total Load Time');
            console.log(`[ExploreDependenciesService] Load complete in ${Date.now() - totalStart}ms`);
            this.perf.report();
        });
    }

    /** Handle the "Open 3D World" command (without a URI) */
    public async open3DWorld() {
        await this.exploreDependencies();
    }

    /** Restore the 3D world if it was previously open */
    public async restore() {
        // Clear reloading flag at the start of restoration
        await this.context.globalState.update(DevManagerV2.RELOADING_FLAG, false);

        let savedPath;
        if (this.stateManager) {
            savedPath = await this.stateManager.loadState<string>({
                key: ExploreDependenciesService.REOPEN_STATE_KEY,
                scope: 'workspace'
            });
        } else {
            // Fallback to old method
            savedPath = this.context.workspaceState.get<string>(ExploreDependenciesService.REOPEN_STATE_KEY);
        }
        
        console.log(`[ExploreDependenciesService] restore() check: savedPath=${savedPath}`);
        if (savedPath) {
            console.log(`[ExploreDependenciesService] Restoring 3D world for: ${savedPath}`);
            await this.exploreDependencies(vscode.Uri.file(savedPath));
        }
    }
}
