/**
 * Dev Manager V2 - Redesigned hot reload system with race condition elimination
 * 
 * This replaces the original DevManager with a properly coordinated system
 * that uses the new lifecycle coordinator to eliminate all race conditions.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { LifecycleCoordinator, EventType } from '../core/lifecycle-coordinator';
import { StateManager, StateConfig } from '../core/state-manager';
import { FileWatcher, FileWatcherConfig } from '../core/file-watcher';

/**
 * Configuration for hot reload behavior
 */
interface HotReloadConfig {
    enabled: boolean;
    watchPatterns: string[];
    debounceMs: number;
    reloadDelayMs: number;
    maxReloadsPerMinute: number;
}

/**
 * Manages hot reload with proper coordination and race condition elimination
 */
export class DevManagerV2 {
    private static readonly CONFIG_KEY = 'openas3d.dev.hotReloadConfig';
    private static readonly RELOAD_COUNT_KEY = 'openas3d.dev.reloadCount';
    private static readonly LAST_RELOAD_KEY = 'openas3d.dev.lastReloadTime';
    public static readonly RELOADING_FLAG = 'openas3d.dev.isReloading';

    private config: HotReloadConfig;
    private fileWatcher: FileWatcher | null = null;
    private reloadCount = 0;
    private lastReloadTime = 0;

    constructor(
        private context: vscode.ExtensionContext,
        private coordinator: LifecycleCoordinator,
        private stateManager: StateManager
    ) {
        this.config = this.loadConfig();
        this.setupEventListeners();
    }

    /**
     * Initialize the dev manager
     */
    public async initialize(): Promise<void> {
        console.log('[DevManagerV2] Initializing...');
        
        // Register commands
        this.registerCommands();
        
        // Restore state
        await this.restoreState();
        
        // Start hot reload if enabled
        if (this.config.enabled) {
            await this.startHotReload();
        }
        
        // Mark extension as ready
        await this.coordinator.emitEvent(EventType.EXTENSION_READY, undefined, 'dev_manager');
    }

    /**
     * Setup event listeners for coordination
     */
    private setupEventListeners(): void {
        // Listen for file changes
        this.coordinator.on(EventType.FILE_CHANGED, async (data) => {
            await this.handleFileChange(data);
        });

        // Listen for reload events
        this.coordinator.on(EventType.RELOAD_STARTED, async () => {
            await this.handleReloadStarted();
        });

        this.coordinator.on(EventType.RELOAD_COMPLETED, async () => {
            await this.handleReloadCompleted();
        });
    }

    /**
     * Register VSCode commands
     */
    private registerCommands(): void {
        // Toggle hot reload command
        const toggleCommand = vscode.commands.registerCommand('openas3d.dev.toggleHotReload', async () => {
            await this.toggleHotReload();
        });

        // Configure hot reload command
        const configCommand = vscode.commands.registerCommand('openas3d.dev.configureHotReload', async () => {
            await this.configureHotReload();
        });

        // Force reload command
        const reloadCommand = vscode.commands.registerCommand('openas3d.dev.forceReload', async () => {
            await this.forceReload();
        });

        this.context.subscriptions.push(toggleCommand, configCommand, reloadCommand);
    }

    /**
     * Toggle hot reload on/off
     */
    public async toggleHotReload(): Promise<void> {
        this.config.enabled = !this.config.enabled;
        await this.saveConfig();

        if (this.config.enabled) {
            await this.startHotReload();
            vscode.window.showInformationMessage('Hot Reload enabled');
        } else {
            await this.stopHotReload();
            vscode.window.showInformationMessage('Hot Reload disabled');
        }
    }

    /**
     * Start hot reload monitoring
     */
    private async startHotReload(): Promise<void> {
        if (this.fileWatcher) {
            return; // Already running
        }

        console.log('[DevManagerV2] Starting hot reload...');

        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            console.warn('[DevManagerV2] No workspace root found');
            return;
        }

        // Create file watcher configuration
        const watcherConfig: FileWatcherConfig = {
            patterns: this.config.watchPatterns,
            debounceMs: this.config.debounceMs,
            ignorePatterns: [
                '**/node_modules/**',
                '**/out/**',
                '**/.git/**',
                '**/coverage/**',
                '**/*.tmp',
                '**/*.log'
            ],
            onFileChange: async (uri) => {
                await this.handleFileChange({ uri, type: 'change' });
            }
        };

        // Create and start file watcher
        this.fileWatcher = new FileWatcher(watcherConfig, this.coordinator);
        await this.fileWatcher.start(workspaceRoot);

        console.log('[DevManagerV2] Hot reload started');
    }

    /**
     * Stop hot reload monitoring
     */
    private async stopHotReload(): Promise<void> {
        if (!this.fileWatcher) {
            return; // Not running
        }

        console.log('[DevManagerV2] Stopping hot reload...');

        this.fileWatcher.dispose();
        this.fileWatcher = null;

        console.log('[DevManagerV2] Hot reload stopped');
    }

    /**
     * Handle file change events
     */
    private async handleFileChange(data: { uri: vscode.Uri; type: string }): Promise<void> {
        const { uri, type } = data;

        // Only handle change events for extension files
        if (type !== 'change') {
            return;
        }

        // Check if this is an extension file we care about
        if (!this.isExtensionFile(uri.fsPath)) {
            return;
        }

        console.log(`[DevManagerV2] Extension file changed: ${uri.fsPath}`);

        // Check rate limiting
        if (!this.checkRateLimit()) {
            console.log('[DevManagerV2] Rate limit exceeded, skipping reload');
            return;
        }

        // Schedule reload
        await this.scheduleReload();
    }

    /**
     * Check if file is an extension file we should watch
     */
    private isExtensionFile(filePath: string): boolean {
        const extPath = this.context.extensionPath;
        const relativePath = path.relative(extPath, filePath);

        // Watch compiled JS files and source TS files
        return relativePath.startsWith('out/extension.js') || 
               relativePath.startsWith('src/extension.ts') ||
               relativePath.endsWith('.js') && relativePath.includes('out/');
    }

    /**
     * Check rate limiting for reloads
     */
    private checkRateLimit(): boolean {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        // Reset counter if more than a minute has passed
        if (this.lastReloadTime < oneMinuteAgo) {
            this.reloadCount = 0;
        }

        // Check if we've exceeded the limit
        if (this.reloadCount >= this.config.maxReloadsPerMinute) {
            return false;
        }

        return true;
    }

    /**
     * Schedule a reload with proper coordination
     */
    private async scheduleReload(): Promise<void> {
        console.log(`[DevManagerV2] Scheduling reload in ${this.config.reloadDelayMs}ms...`);

        // Update reload tracking
        this.reloadCount++;
        this.lastReloadTime = Date.now();
        await this.saveReloadState();

        // Schedule the reload
        setTimeout(async () => {
            await this.executeReload();
        }, this.config.reloadDelayMs);
    }

    /**
     * Execute the actual reload with coordination
     */
    private async executeReload(): Promise<void> {
        if (this.coordinator.isReloading()) {
            console.log('[DevManagerV2] Already reloading, skipping...');
            return;
        }

        console.log('[DevManagerV2] Executing reload...');

        try {
            // Emit reload requested event
            await this.coordinator.emitEvent(EventType.RELOAD_REQUESTED, undefined, 'dev_manager');

            // The actual reload will be handled by the lifecycle coordinator
            // after all state is saved and operations are completed

        } catch (error) {
            console.error('[DevManagerV2] Error during reload:', error);
            vscode.window.showErrorMessage(`Reload failed: ${error}`);
        }
    }

    /**
     * Handle reload started event
     */
    private async handleReloadStarted(): Promise<void> {
        console.log('[DevManagerV2] Reload started');
        
        // Show notification
        vscode.window.showInformationMessage('Extension is reloading...', 'OK');
    }

    /**
     * Handle reload completed event
     */
    private async handleReloadCompleted(): Promise<void> {
        console.log('[DevManagerV2] Reload completed');
        
        // Restore state
        await this.restoreState();
        
        // Restart hot reload if it was enabled
        if (this.config.enabled && !this.fileWatcher) {
            await this.startHotReload();
        }
    }

    /**
     * Force an immediate reload
     */
    public async forceReload(): Promise<void> {
        console.log('[DevManagerV2] Force reload requested');
        await this.executeReload();
    }

    /**
     * Configure hot reload settings
     */
    private async configureHotReload(): Promise<void> {
        // Create quick pick for configuration
        const options = [
            { label: 'Toggle Enable/Disable', description: `Currently: ${this.config.enabled ? 'Enabled' : 'Disabled'}` },
            { label: 'Change Watch Patterns', description: `Current: ${this.config.watchPatterns.join(', ')}` },
            { label: 'Change Debounce Time', description: `Current: ${this.config.debounceMs}ms` },
            { label: 'Change Reload Delay', description: `Current: ${this.config.reloadDelayMs}ms` },
            { label: 'Change Max Reloads/Minute', description: `Current: ${this.config.maxReloadsPerMinute}` }
        ];

        const choice = await vscode.window.showQuickPick(options, {
            placeHolder: 'Select hot reload setting to configure'
        });

        if (!choice) {
            return;
        }

        switch (choice.label) {
            case 'Toggle Enable/Disable':
                await this.toggleHotReload();
                break;
            case 'Change Watch Patterns':
                await this.changeWatchPatterns();
                break;
            case 'Change Debounce Time':
                await this.changeDebounceTime();
                break;
            case 'Change Reload Delay':
                await this.changeReloadDelay();
                break;
            case 'Change Max Reloads/Minute':
                await this.changeMaxReloads();
                break;
        }
    }

    // Configuration helper methods
    private async changeWatchPatterns(): Promise<void> {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter watch patterns (comma-separated)',
            value: this.config.watchPatterns.join(', ')
        });

        if (input) {
            this.config.watchPatterns = input.split(',').map(p => p.trim());
            await this.saveConfig();
            await this.restartHotReload();
        }
    }

    private async changeDebounceTime(): Promise<void> {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter debounce time in milliseconds',
            value: this.config.debounceMs.toString()
        });

        if (input && !isNaN(Number(input))) {
            this.config.debounceMs = Number(input);
            await this.saveConfig();
            await this.restartHotReload();
        }
    }

    private async changeReloadDelay(): Promise<void> {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter reload delay in milliseconds',
            value: this.config.reloadDelayMs.toString()
        });

        if (input && !isNaN(Number(input))) {
            this.config.reloadDelayMs = Number(input);
            await this.saveConfig();
        }
    }

    private async changeMaxReloads(): Promise<void> {
        const input = await vscode.window.showInputBox({
            prompt: 'Enter maximum reloads per minute',
            value: this.config.maxReloadsPerMinute.toString()
        });

        if (input && !isNaN(Number(input))) {
            this.config.maxReloadsPerMinute = Number(input);
            await this.saveConfig();
        }
    }

    private async restartHotReload(): Promise<void> {
        if (this.config.enabled) {
            await this.stopHotReload();
            await this.startHotReload();
        }
    }

    // State management methods
    private loadConfig(): HotReloadConfig {
        return this.context.globalState.get<HotReloadConfig>(DevManagerV2.CONFIG_KEY) || {
            enabled: false,
            watchPatterns: ['out/extension.js', 'src/**/*.ts'],
            debounceMs: 300,
            reloadDelayMs: 1000,
            maxReloadsPerMinute: 5
        };
    }

    private async saveConfig(): Promise<void> {
        await this.context.globalState.update(DevManagerV2.CONFIG_KEY, this.config);
    }

    private async saveReloadState(): Promise<void> {
        await this.context.globalState.update(DevManagerV2.RELOAD_COUNT_KEY, this.reloadCount);
        await this.context.globalState.update(DevManagerV2.LAST_RELOAD_KEY, this.lastReloadTime);
    }

    private async restoreState(): Promise<void> {
        this.reloadCount = this.context.globalState.get(DevManagerV2.RELOAD_COUNT_KEY, 0);
        this.lastReloadTime = this.context.globalState.get(DevManagerV2.LAST_RELOAD_KEY, 0);
    }

    /**
     * Dispose the dev manager
     */
    public dispose(): void {
        console.log('[DevManagerV2] Disposing...');
        
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
            this.fileWatcher = null;
        }
    }
}
