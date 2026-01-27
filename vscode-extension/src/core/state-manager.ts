/**
 * State Manager - Thread-safe state persistence with proper coordination
 * 
 * Replaces the scattered state management with a centralized, event-driven system
 * that eliminates race conditions between state operations and reloads.
 */

import * as vscode from 'vscode';
import { LifecycleCoordinator, EventType } from './lifecycle-coordinator';
import { Logger } from './logger';
import { ErrorRecoverySystem, ErrorCategory, ErrorSeverity } from './error-recovery';

export interface StateSnapshot {
    version: string;
    timestamp: number;
    data: any;
    checksum?: string;
}

export interface StateConfig {
    key: string;
    scope: 'global' | 'workspace';
    ttl?: number; // Time to live in milliseconds
    maxSize?: number; // Maximum size in bytes
}

/**
 * Manages state persistence with proper lifecycle coordination
 */
export class StateManager implements vscode.Disposable {
    private snapshots: Map<string, StateSnapshot> = new Map();
    private saveQueue: Map<string, Promise<void>> = new Map();
    private isReloading = false;
    private logger = Logger.getInstance();
    private disposables: vscode.Disposable[] = [];

    constructor(
        private context: vscode.ExtensionContext,
        private coordinator: LifecycleCoordinator,
        private errorRecovery?: ErrorRecoverySystem
    ) {
        this.setupEventListeners();
    }

    /**
     * Setup event listeners for lifecycle coordination
     */
    private setupEventListeners(): void {
        // Listen for reload events
        this.coordinator.on(EventType.RELOAD_REQUESTED, async () => {
            this.isReloading = true;
            await this.flushAllPendingSaves();
        });

        this.coordinator.on(EventType.RELOAD_COMPLETED, async () => {
            this.isReloading = false;
        });

        // Listen for state events
        this.coordinator.on(EventType.STATE_SAVING, async () => {
            await this.createSnapshot();
        });

        this.coordinator.on(EventType.STATE_LOADING, async () => {
            await this.restoreFromSnapshot();
        });
    }

    /**
     * Save state with proper coordination and deduplication
     */
    public async saveState(config: StateConfig, data: any): Promise<void> {
        if (this.coordinator.isReloading()) {
            this.logger.debug(`[StateManager] Skipping save during reload for key: ${config.key}`);
            return;
        }

        // Check if already saving this key
        if (this.saveQueue.has(config.key)) {
            this.logger.debug(`[StateManager] Save already in progress for key: ${config.key}`);
            return;
        }

        const savePromise = this.coordinator.executeOperation(
            () => this.performSave(config, data),
            `save_state:${config.key}`
        );
        this.saveQueue.set(config.key, savePromise);

        try {
            await savePromise;
        } finally {
            this.saveQueue.delete(config.key);
        }
    }

    /**
     * Perform the actual save operation with validation
     */
    private async performSave(config: StateConfig, data: any): Promise<void> {
        try {
            // Validate data size
            const serialized = JSON.stringify(data);
            if (config.maxSize && serialized.length > config.maxSize) {
                throw new Error(`State data exceeds maximum size: ${serialized.length} > ${config.maxSize}`);
            }

            // Create snapshot
            const snapshot: StateSnapshot = {
                version: '1.0',
                timestamp: Date.now(),
                data,
                checksum: this.calculateChecksum(serialized)
            };

            // Store in memory
            this.snapshots.set(config.key, snapshot);

            // Persist to VSCode storage
            const storage = config.scope === 'global'
                ? this.context.globalState
                : this.context.workspaceState;

            await storage.update(config.key, snapshot);

            this.logger.debug(`[StateManager] Saved state for key: ${config.key} (${serialized.length} bytes)`);

        } catch (error) {
            this.logger.error(`[StateManager] Failed to save state for key: ${config.key}`, error);

            if (this.errorRecovery) {
                await this.errorRecovery.reportError(
                    ErrorCategory.STATE_MANAGEMENT,
                    ErrorSeverity.MEDIUM,
                    `Failed to save state for key: ${config.key}`,
                    { config, error }
                );
            }
            throw error;
        }
    }

    /**
     * Load state with proper validation
     */
    public async loadState<T>(config: StateConfig): Promise<T | undefined> {
        try {
            // Check in-memory cache first
            if (this.snapshots.has(config.key)) {
                return this.snapshots.get(config.key)!.data as T;
            }

            const storage = config.scope === 'global'
                ? this.context.globalState
                : this.context.workspaceState;

            const snapshot = storage.get<StateSnapshot>(config.key);

            if (!snapshot) {
                this.logger.debug(`[StateManager] No saved state found for key: ${config.key}`);
                return undefined;
            }

            // Validate snapshot
            if (!this.validateSnapshot(snapshot, config)) {
                this.logger.warn(`[StateManager] Invalid snapshot for key: ${config.key}, clearing...`);
                await this.clearState(config);
                return undefined;
            }

            this.logger.debug(`[StateManager] Loaded state for key: ${config.key}`);
            return snapshot.data as T;

        } catch (error) {
            this.logger.error(`[StateManager] Failed to load state for key: ${config.key}`, error);
            return undefined;
        }
    }

    /**
     * Clear state
     */
    public async clearState(config: StateConfig): Promise<void> {
        try {
            const storage = config.scope === 'global'
                ? this.context.globalState
                : this.context.workspaceState;

            await storage.update(config.key, undefined);
            this.snapshots.delete(config.key);

            this.logger.info(`[StateManager] Cleared state for key: ${config.key}`);

        } catch (error) {
            this.logger.error(`[StateManager] Failed to clear state for key: ${config.key}`, error);
        }
    }

    /**
     * Create a complete snapshot of all state
     */
    private async createSnapshot(): Promise<void> {
        this.logger.info('[StateManager] Creating complete state snapshot...');

        // This would be called during reload to ensure all state is saved
        const snapshot = {
            timestamp: Date.now(),
            snapshots: Object.fromEntries(this.snapshots)
        };

        // Store the complete snapshot
        await this.context.globalState.update('openas3d.completeSnapshot', snapshot);
    }

    /**
     * Restore from complete snapshot
     */
    private async restoreFromSnapshot(): Promise<void> {
        this.logger.info('[StateManager] Restoring from complete snapshot...');

        const snapshot = await this.context.globalState.get<any>('openas3d.completeSnapshot');

        if (snapshot) {
            // Restore individual snapshots
            this.snapshots.clear();
            Object.entries(snapshot.snapshots as Record<string, StateSnapshot>).forEach(([key, snap]) => {
                this.snapshots.set(key, snap);
            });

            this.logger.info('[StateManager] Restored complete snapshot');
        }
    }

    /**
     * Wait for all pending save operations
     */
    private async flushAllPendingSaves(): Promise<void> {
        const pendingSaves = Array.from(this.saveQueue.values());
        if (pendingSaves.length > 0) {
            this.logger.info(`[StateManager] Waiting for ${pendingSaves.length} pending saves...`);
            await Promise.all(pendingSaves);
        }
    }

    /**
     * Validate snapshot integrity
     */
    private validateSnapshot(snapshot: StateSnapshot, config: StateConfig): boolean {
        // Check TTL
        if (config.ttl && Date.now() - snapshot.timestamp > config.ttl) {
            this.logger.debug(`[StateManager] Snapshot expired for key: ${config.key}`);
            return false;
        }

        // Check checksum
        if (snapshot.checksum) {
            const serialized = JSON.stringify(snapshot.data);
            const currentChecksum = this.calculateChecksum(serialized);
            if (currentChecksum !== snapshot.checksum) {
                this.logger.warn(`[StateManager] Checksum mismatch for key: ${config.key}`);
                return false;
            }
        }

        return true;
    }

    /**
     * Calculate checksum for data integrity
     */
    private calculateChecksum(data: string): string {
        // Simple checksum for now - could be upgraded to crypto hash
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(16);
    }

    /**
     * Get state statistics
     */
    public getStats(): { totalKeys: number; totalSize: number; pendingSaves: number } {
        let totalSize = 0;
        for (const snapshot of this.snapshots.values()) {
            totalSize += JSON.stringify(snapshot.data).length;
        }

        return {
            totalKeys: this.snapshots.size,
            totalSize,
            pendingSaves: this.saveQueue.size
        };
    }

    public dispose(): void {
        this.logger.info('[StateManager] Disposing state manager...');
        this.disposables.forEach(d => d.dispose());
        this.disposables = [];
        this.snapshots.clear();
        this.saveQueue.clear();
    }
}
