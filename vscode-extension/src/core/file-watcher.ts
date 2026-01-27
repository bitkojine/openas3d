/**
 * File Watcher - Coordinated file system monitoring with debouncing
 * 
 * Eliminates race conditions from file watching by using proper debouncing,
 * event coordination, and lifecycle management.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { LifecycleCoordinator, EventType } from './lifecycle-coordinator';

export interface FileWatcherConfig {
    patterns: string[];
    debounceMs?: number;
    ignorePatterns?: string[];
    onFileChange?: (uri: vscode.Uri) => Promise<void>;
    onFileCreate?: (uri: vscode.Uri) => Promise<void>;
    onFileDelete?: (uri: vscode.Uri) => Promise<void>;
}

interface FileChangeEvent {
    uri: vscode.Uri;
    type: 'change' | 'create' | 'delete';
    timestamp: number;
}

/**
 * Manages file watching with proper debouncing and coordination
 */
export class FileWatcher {
    private watchers: fs.FSWatcher[] = [];
    private vscodeWatchers: vscode.FileSystemWatcher[] = [];
    private eventQueue: FileChangeEvent[] = [];
    private debounceTimer: NodeJS.Timeout | null = null;
    private isProcessing = false;
    private disposed = false;

    constructor(
        private config: FileWatcherConfig,
        private coordinator: LifecycleCoordinator
    ) {
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for lifecycle coordination
     */
    private setupEventListeners(): void {
        this.coordinator.on(EventType.RELOAD_REQUESTED, async () => {
            await this.pause();
        });

        this.coordinator.on(EventType.RELOAD_COMPLETED, async () => {
            await this.resume();
        });
    }

    /**
     * Start watching files
     */
    public async start(workspaceRoot: string): Promise<void> {
        if (this.disposed) {
            throw new Error('FileWatcher has been disposed');
        }

        console.log(`[FileWatcher] Starting to watch patterns: ${this.config.patterns.join(', ')}`);

        // Try to use VSCode's file watcher first (more reliable)
        try {
            await this.startVSCodeWatcher(workspaceRoot);
        } catch (error) {
            console.warn('[FileWatcher] VSCode watcher failed, falling back to fs.watch:', error);
            await this.startFSWatcher(workspaceRoot);
        }
    }

    /**
     * Start using VSCode's file watcher
     */
    private async startVSCodeWatcher(workspaceRoot: string): Promise<void> {
        for (const pattern of this.config.patterns) {
            const fullPattern = new vscode.RelativePattern(workspaceRoot, pattern);
            const watcher = vscode.workspace.createFileSystemWatcher(fullPattern);

            // Setup event handlers
            watcher.onDidCreate(async (uri) => {
                await this.queueEvent({ uri, type: 'create', timestamp: Date.now() });
            });

            watcher.onDidChange(async (uri) => {
                await this.queueEvent({ uri, type: 'change', timestamp: Date.now() });
            });

            watcher.onDidDelete(async (uri) => {
                await this.queueEvent({ uri, type: 'delete', timestamp: Date.now() });
            });

            this.vscodeWatchers.push(watcher);
        }

        console.log(`[FileWatcher] Started ${this.vscodeWatchers.length} VSCode watchers`);
    }

    /**
     * Start using Node.js fs.watch (fallback)
     */
    private async startFSWatcher(workspaceRoot: string): Promise<void> {
        for (const pattern of this.config.patterns) {
            const watchPath = path.join(workspaceRoot, pattern);
            
            // Extract directory from pattern
            const dir = path.dirname(watchPath);
            
            if (!fs.existsSync(dir)) {
                console.warn(`[FileWatcher] Watch directory does not exist: ${dir}`);
                continue;
            }

            const watcher = fs.watch(dir, (eventType, filename) => {
                if (!filename) return;

                const filePath = path.join(dir, filename);
                const uri = vscode.Uri.file(filePath);

                // Check if file matches our patterns
                if (this.matchesPattern(filePath, workspaceRoot)) {
                    const changeType = eventType === 'rename' ? 'delete' : 'change';
                    this.queueEvent({ uri, type: changeType, timestamp: Date.now() });
                }
            });

            this.watchers.push(watcher);
        }

        console.log(`[FileWatcher] Started ${this.watchers.length} fs.watch watchers`);
    }

    /**
     * Queue file change event with debouncing
     */
    private async queueEvent(event: FileChangeEvent): Promise<void> {
        if (this.disposed || this.coordinator.isReloading()) {
            return;
        }

        // Check ignore patterns
        if (this.shouldIgnore(event.uri.fsPath)) {
            return;
        }

        // Add to queue
        this.eventQueue.push(event);

        // Setup debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }

        const debounceMs = this.config.debounceMs || 300;
        this.debounceTimer = setTimeout(() => {
            this.processEventQueue();
        }, debounceMs);
    }

    /**
     * Process queued events
     */
    private async processEventQueue(): Promise<void> {
        if (this.isProcessing || this.eventQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        try {
            // Group events by file and keep only the latest event per file
            const latestEvents = new Map<string, FileChangeEvent>();
            
            for (const event of this.eventQueue) {
                const key = event.uri.fsPath;
                const existing = latestEvents.get(key);
                
                if (!existing || event.timestamp > existing.timestamp) {
                    latestEvents.set(key, event);
                }
            }

            // Process each latest event
            for (const event of latestEvents.values()) {
                await this.processEvent(event);
            }

            // Clear queue
            this.eventQueue = [];

        } catch (error) {
            console.error('[FileWatcher] Error processing event queue:', error);
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Process individual event
     */
    private async processEvent(event: FileChangeEvent): Promise<void> {
        console.log(`[FileWatcher] Processing ${event.type} event: ${event.uri.fsPath}`);

        try {
            // Check if file still exists for delete events
            if (event.type === 'delete') {
                try {
                    await vscode.workspace.fs.stat(event.uri);
                    // File still exists - this might be a rename, treat as change
                    event.type = 'change';
                } catch {
                    // File truly doesn't exist
                }
            }

            // Emit coordinated event
            await this.coordinator.emitEvent(EventType.FILE_CHANGED, {
                uri: event.uri,
                type: event.type
            }, 'file_watcher');

            // Call specific handlers
            switch (event.type) {
                case 'create':
                    if (this.config.onFileCreate) {
                        await this.config.onFileCreate(event.uri);
                    }
                    break;
                case 'change':
                    if (this.config.onFileChange) {
                        await this.config.onFileChange(event.uri);
                    }
                    break;
                case 'delete':
                    if (this.config.onFileDelete) {
                        await this.config.onFileDelete(event.uri);
                    }
                    break;
            }

        } catch (error) {
            console.error(`[FileWatcher] Error processing event for ${event.uri.fsPath}:`, error);
        }
    }

    /**
     * Check if file path matches any of our patterns
     */
    private matchesPattern(filePath: string, workspaceRoot: string): boolean {
        const relativePath = path.relative(workspaceRoot, filePath);
        
        for (const pattern of this.config.patterns) {
            // Simple glob matching (could be enhanced with minimatch)
            if (this.simpleGlobMatch(relativePath, pattern)) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Simple glob pattern matching
     */
    private simpleGlobMatch(str: string, pattern: string): boolean {
        const regexPattern = pattern
            .replace(/\*\*/g, '.*')
            .replace(/\*/g, '[^/]*')
            .replace(/\?/g, '[^/]');
        
        const regex = new RegExp(`^${regexPattern}$`);
        return regex.test(str);
    }

    /**
     * Check if file should be ignored
     */
    private shouldIgnore(filePath: string): boolean {
        if (!this.config.ignorePatterns) {
            return false;
        }

        for (const ignorePattern of this.config.ignorePatterns) {
            if (this.simpleGlobMatch(filePath, ignorePattern)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Pause watching (during reload)
     */
    public async pause(): Promise<void> {
        console.log('[FileWatcher] Pausing file watching...');
        
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    /**
     * Resume watching (after reload)
     */
    public async resume(): Promise<void> {
        console.log('[FileWatcher] Resuming file watching...');
        
        // Process any queued events that occurred during pause
        if (this.eventQueue.length > 0) {
            await this.processEventQueue();
        }
    }

    /**
     * Dispose all watchers
     */
    public dispose(): void {
        console.log('[FileWatcher] Disposing...');

        this.disposed = true;

        // Clear debounce timer
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }

        // Close fs watchers
        this.watchers.forEach(watcher => watcher.close());
        this.watchers = [];

        // Dispose VSCode watchers
        this.vscodeWatchers.forEach(watcher => watcher.dispose());
        this.vscodeWatchers = [];

        // Clear queue
        this.eventQueue = [];
    }
}
