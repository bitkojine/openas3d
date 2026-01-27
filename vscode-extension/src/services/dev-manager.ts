import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * DevManager - Handles developer-specific features like "Hot Reload".
 */
export class DevManager {
    private static IS_WATCHING_KEY = 'openas3d.dev.isWatching';
    public static RELOADING_FLAG = 'openas3d.dev.isReloading';

    constructor(private context: vscode.ExtensionContext) { }

    public initialize(): void {
        this.registerCommands();

        // Restore watching state if it was active
        if (this.context.globalState.get(DevManager.IS_WATCHING_KEY)) {
            this.startWatcher();
        }
    }

    private registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('openas3d.dev.toggleHotReload', () => {
                const currentState = !!this.context.globalState.get(DevManager.IS_WATCHING_KEY);
                const newState = !currentState;

                this.context.globalState.update(DevManager.IS_WATCHING_KEY, newState);

                if (newState) {
                    vscode.window.showInformationMessage('Hot Reload enabled. Extension will reload when "out/extension.js" is updated.');
                    this.startWatcher();
                } else {
                    vscode.window.showInformationMessage('Hot Reload disabled.');
                    // Note: Actual watcher disposal would be better but we'll reload anyway if it was active
                }
            })
        );
    }

    private lastReloadTime = 0;

    private startWatcher(): void {
        const outDir = path.join(this.context.extensionPath, 'out');
        const extensionJsPath = path.join(outDir, 'extension.js');

        if (!fs.existsSync(outDir)) {
            console.error(`[DevManager] Cannot start watcher: ${outDir} does not exist.`);
            return;
        }

        console.log(`[DevManager] Starting robust watcher on ${outDir}`);

        try {
            const watcher = fs.watch(outDir, (eventType, filename) => {
                if (filename === 'extension.js' && eventType === 'change') {
                    const now = Date.now();
                    const COOLDOWN_MS = 3000;

                    if (now - this.lastReloadTime < COOLDOWN_MS) {
                        return;
                    }

                    this.lastReloadTime = now;
                    console.log('[DevManager] extension.js changed. Reloading in 1000ms...');

                    setTimeout(async () => {
                        console.log('[DevManager] Setting reloading flag and triggering reload...');
                        await this.context.globalState.update(DevManager.RELOADING_FLAG, true);
                        vscode.commands.executeCommand('workbench.action.reloadWindow');
                    }, 1000);
                }
            });

            this.context.subscriptions.push({ dispose: () => watcher.close() });
        } catch (err) {
            console.error(`[DevManager] Failed to start fs.watch: ${err}`);

            // Fallback to VSCode watcher if fs.watch fails for some reason
            const vsWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(vscode.Uri.file(outDir), 'extension.js')
            );
            vsWatcher.onDidChange(() => {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            });
            this.context.subscriptions.push(vsWatcher);
        }
    }
}
