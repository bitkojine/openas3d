/**
 * Lifecycle Coordinator - Centralized event-driven system to eliminate race conditions
 * 
 * This coordinator manages the lifecycle of all extension components using a state machine
 * approach with proper event ordering and async flow control.
 */

import * as vscode from 'vscode';
import { EventEmitter } from 'events';

export enum ExtensionState {
    INITIALIZING = 'initializing',
    READY = 'ready', 
    BUSY = 'busy',
    RELOADING = 'reloading',
    SHUTTING_DOWN = 'shutting_down'
}

export enum EventType {
    // Core lifecycle events
    EXTENSION_ACTIVATED = 'extension_activated',
    EXTENSION_READY = 'extension_ready',
    RELOAD_REQUESTED = 'reload_requested',
    RELOAD_STARTED = 'reload_started',
    RELOAD_COMPLETED = 'reload_completed',
    
    // Webview events
    WEBVIEW_CREATED = 'webview_created',
    WEBVIEW_READY = 'webview_ready',
    WEBVIEW_DISPOSED = 'webview_disposed',
    
    // State events
    STATE_SAVING = 'state_saving',
    STATE_SAVED = 'state_saved',
    STATE_LOADING = 'state_loading',
    STATE_LOADED = 'state_loaded',
    
    // File system events
    FILE_CHANGED = 'file_changed',
    ANALYSIS_STARTED = 'analysis_started',
    ANALYSIS_COMPLETED = 'analysis_completed'
}

interface LifecycleEvent {
    type: EventType;
    timestamp: number;
    data?: any;
    source: string;
}

interface StateTransition {
    from: ExtensionState;
    to: ExtensionState;
    event: EventType;
    handler: () => Promise<void>;
}

/**
 * Central coordinator that manages all extension lifecycle events
 */
export class LifecycleCoordinator extends EventEmitter {
    private currentState: ExtensionState = ExtensionState.INITIALIZING;
    private eventQueue: LifecycleEvent[] = [];
    private isProcessing = false;
    private transitions: Map<string, StateTransition> = new Map();
    
    // Promise-based coordination
    private pendingOperations: Map<string, Promise<any>> = new Map();
    private operationCounter = 0;

    constructor() {
        super();
        this.setupTransitions();
        this.setupErrorHandling();
    }

    /**
     * Register state transitions with their handlers
     */
    private setupTransitions(): void {
        // Initial activation
        this.addTransition(
            ExtensionState.INITIALIZING,
            ExtensionState.READY,
            EventType.EXTENSION_READY,
            async () => this.handleExtensionReady()
        );

        // Reload flow
        this.addTransition(
            ExtensionState.READY,
            ExtensionState.RELOADING,
            EventType.RELOAD_REQUESTED,
            async () => this.handleReloadRequested()
        );

        this.addTransition(
            ExtensionState.RELOADING,
            ExtensionState.READY,
            EventType.RELOAD_COMPLETED,
            async () => this.handleReloadCompleted()
        );

        // Busy state during operations
        this.addTransition(
            ExtensionState.READY,
            ExtensionState.BUSY,
            EventType.ANALYSIS_STARTED,
            async () => this.handleAnalysisStarted()
        );

        this.addTransition(
            ExtensionState.BUSY,
            ExtensionState.READY,
            EventType.ANALYSIS_COMPLETED,
            async () => this.handleAnalysisCompleted()
        );
    }

    /**
     * Add a state transition
     */
    private addTransition(
        from: ExtensionState, 
        to: ExtensionState, 
        event: EventType, 
        handler: () => Promise<void>
    ): void {
        const key = `${from}->${to}:${event}`;
        this.transitions.set(key, { from, to, event, handler });
    }

    /**
     * Setup error handling for uncaught exceptions
     */
    private setupErrorHandling(): void {
        this.on('error', (error) => {
            console.error('[LifecycleCoordinator] Unhandled error:', error);
            // Attempt recovery by returning to ready state if possible
            if (this.canTransitionTo(ExtensionState.READY)) {
                this.currentState = ExtensionState.READY;
            }
        });
    }

    /**
     * Emit a lifecycle event with proper queuing
     */
    public async emitEvent(type: EventType, data?: any, source = 'unknown'): Promise<void> {
        const event: LifecycleEvent = {
            type,
            timestamp: Date.now(),
            data,
            source
        };

        this.eventQueue.push(event);
        
        if (!this.isProcessing) {
            await this.processEventQueue();
        }
    }

    /**
     * Process events in order with proper state management
     */
    private async processEventQueue(): Promise<void> {
        if (this.isProcessing) return;
        
        this.isProcessing = true;

        try {
            while (this.eventQueue.length > 0) {
                const event = this.eventQueue.shift()!;
                await this.handleEvent(event);
            }
        } catch (error) {
            this.emit('error', error);
            // Don't re-throw, just continue processing
        } finally {
            this.isProcessing = false;
        }
    }

    /**
     * Handle individual event with state machine logic
     */
    private async handleEvent(event: LifecycleEvent): Promise<void> {
        console.log(`[LifecycleCoordinator] Processing event: ${event.type} from ${event.source}`);

        // Find matching transition
        for (const [key, transition] of this.transitions) {
            if (transition.from === this.currentState && transition.event === event.type) {
                console.log(`[LifecycleCoordinator] State transition: ${this.currentState} -> ${transition.to}`);
                await this.setState(transition.to);
                await transition.handler();
                // Also emit the event for listeners
                this.emit(event.type, event.data);
                return;
            }
        }

        // No transition found - emit as regular event
        this.emit(event.type, event.data);
    }

    /**
     * Change state with validation
     */
    private async setState(newState: ExtensionState): Promise<void> {
        if (!this.canTransitionTo(newState)) {
            throw new Error(`Invalid state transition: ${this.currentState} -> ${newState}`);
        }
        
        const oldState = this.currentState;
        this.currentState = newState;
        this.emit('stateChanged', { oldState, newState });
    }

    /**
     * Check if state transition is valid
     */
    private canTransitionTo(newState: ExtensionState): boolean {
        // Define valid transitions
        const validTransitions: Record<ExtensionState, ExtensionState[]> = {
            [ExtensionState.INITIALIZING]: [ExtensionState.READY],
            [ExtensionState.READY]: [ExtensionState.BUSY, ExtensionState.RELOADING, ExtensionState.SHUTTING_DOWN],
            [ExtensionState.BUSY]: [ExtensionState.READY, ExtensionState.RELOADING, ExtensionState.SHUTTING_DOWN],
            [ExtensionState.RELOADING]: [ExtensionState.READY, ExtensionState.SHUTTING_DOWN],
            [ExtensionState.SHUTTING_DOWN]: [] // Terminal state
        };

        return validTransitions[this.currentState].includes(newState);
    }

    /**
     * Execute an operation with proper coordination
     */
    public async executeOperation<T>(
        operation: () => Promise<T>,
        operationType: string
    ): Promise<T> {
        const operationId = `${operationType}_${++this.operationCounter}`;
        
        try {
            // Register operation
            const promise = operation();
            this.pendingOperations.set(operationId, promise);
            
            // Wait for completion
            const result = await promise;
            
            return result;
        } finally {
            // Clean up
            this.pendingOperations.delete(operationId);
        }
    }

    /**
     * Wait for all pending operations to complete
     */
    public async waitForPendingOperations(): Promise<void> {
        const operations = Array.from(this.pendingOperations.values());
        await Promise.all(operations);
    }

    // State handlers
    private async handleExtensionReady(): Promise<void> {
        console.log('[LifecycleCoordinator] Extension is ready');
        // Extension is fully initialized and ready for operations
    }

    private async handleReloadRequested(): Promise<void> {
        console.log('[LifecycleCoordinator] Reload requested, saving state...');
        
        // Emit state saving event
        await this.emitEvent(EventType.STATE_SAVING, undefined, 'reload_handler');
        
        // Wait for all pending operations
        await this.waitForPendingOperations();
        
        // Set reload flag
        await this.setReloadFlag(true);
        
        // Don't actually trigger reload in tests - just emit the event
        console.log('[LifecycleCoordinator] Reload would be triggered here');
        await this.emitEvent(EventType.RELOAD_STARTED, undefined, 'reload_handler');
    }

    private async handleReloadCompleted(): Promise<void> {
        console.log('[LifecycleCoordinator] Reload completed');
        
        // Clear reload flag
        await this.setReloadFlag(false);
        
        // Restore state
        await this.emitEvent(EventType.STATE_LOADING, undefined, 'reload_handler');
    }

    private async handleAnalysisStarted(): Promise<void> {
        console.log('[LifecycleCoordinator] Analysis started');
        // Extension is busy with analysis
    }

    private async handleAnalysisCompleted(): Promise<void> {
        console.log('[LifecycleCoordinator] Analysis completed');
        // Extension is ready again
    }

    private async setReloadFlag(isReloading: boolean): Promise<void> {
        // This would be injected or passed in
        console.log(`[LifecycleCoordinator] Setting reload flag: ${isReloading}`);
        // Don't actually execute VSCode commands in tests
        if (typeof vscode !== 'undefined' && vscode.commands && vscode.commands.executeCommand) {
            try {
                // Only execute in non-test environment
                if (process.env.NODE_ENV !== 'test') {
                    await vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            } catch (error) {
                console.warn('[LifecycleCoordinator] Could not execute reload command:', error);
            }
        }
    }

    // Public API
    public getState(): ExtensionState {
        return this.currentState;
    }

    public isReady(): boolean {
        return this.currentState === ExtensionState.READY;
    }

    public isReloading(): boolean {
        return this.currentState === ExtensionState.RELOADING;
    }

    public isBusy(): boolean {
        return this.currentState === ExtensionState.BUSY;
    }
}
