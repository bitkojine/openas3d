import * as vscode from 'vscode';
import { LifecycleCoordinator, ExtensionState, EventType } from '../lifecycle-coordinator';

jest.mock('vscode', () => ({
    commands: {
        executeCommand: jest.fn()
    },
    extensions: {
        getExtension: jest.fn()
    },
    Disposable: jest.fn()
}), { virtual: true });

// Mock Logger
jest.mock('../logger', () => ({
    Logger: {
        getInstance: jest.fn().mockReturnValue({
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        })
    }
}));

describe('LifecycleCoordinator', () => {
    let coordinator: LifecycleCoordinator;

    beforeEach(() => {
        jest.clearAllMocks();
        coordinator = new LifecycleCoordinator();
    });

    afterEach(() => {
        coordinator.dispose();
    });

    /**
     * Tests the initial state of the coordinator.
     */
    it('should start in INITIALIZING state', () => {
        expect(coordinator.getState()).toBe(ExtensionState.INITIALIZING);
    });

    /**
     * Tests the primary initialization transition.
     * Verifies that the state moves to READY when the extension signals it is ready.
     */
    it('should transition to READY on EXTENSION_READY event', async () => {
        await coordinator.emitEvent(EventType.EXTENSION_READY);
        expect(coordinator.getState()).toBe(ExtensionState.READY);
        expect(coordinator.isReady()).toBe(true);
    });

    /**
     * Tests the transition to the RELOADING maintenance state.
     */
    it('should transition to RELOADING on RELOAD_REQUESTED event', async () => {
        await coordinator.emitEvent(EventType.EXTENSION_READY);
        await coordinator.emitEvent(EventType.RELOAD_REQUESTED);
        expect(coordinator.getState()).toBe(ExtensionState.RELOADING);
        expect(coordinator.isReloading()).toBe(true);
    });

    /**
     * Tests recovery from the RELOADING state back to READY.
     */
    it('should transition back to READY after RELOAD_COMPLETED', async () => {
        await coordinator.emitEvent(EventType.EXTENSION_READY);
        await coordinator.emitEvent(EventType.RELOAD_REQUESTED);
        await coordinator.emitEvent(EventType.RELOAD_COMPLETED);
        expect(coordinator.getState()).toBe(ExtensionState.READY);
    });

    /**
     * Tests the transition to BUSY during background analysis tasks
     * and the automatic return to READY once analysis completes.
     */
    it('should transition to BUSY during analysis', async () => {
        await coordinator.emitEvent(EventType.EXTENSION_READY);
        await coordinator.emitEvent(EventType.ANALYSIS_STARTED);
        expect(coordinator.getState()).toBe(ExtensionState.BUSY);
        expect(coordinator.isBusy()).toBe(true);

        await coordinator.emitEvent(EventType.ANALYSIS_COMPLETED);
        expect(coordinator.getState()).toBe(ExtensionState.READY);
    });

    /**
     * Tests the state machine's validation logic.
     * Verifies that the coordinator prevents illegal state transitions
     * (e.g., trying to start analysis before the extension is ready).
     */
    it('should throw error for invalid transitions', async () => {
        // Can't go from INITIALIZING to BUSY directly
        await expect(coordinator.emitEvent(EventType.ANALYSIS_STARTED))
            .rejects.toThrow('Invalid state transition');
    });

    /**
     * Tests event serialization.
     * Verifies that multiple events emitted in rapid succession are
     * processed in the order they were received.
     */
    it('should process events in order', async () => {
        const events: string[] = [];
        coordinator.on(EventType.EXTENSION_READY, () => events.push('ready'));
        coordinator.on(EventType.ANALYSIS_STARTED, () => events.push('busy'));

        // Emit events in a row
        const p1 = coordinator.emitEvent(EventType.EXTENSION_READY);
        const p2 = coordinator.emitEvent(EventType.ANALYSIS_STARTED);

        await Promise.all([p1, p2]);

        expect(events).toEqual(['ready', 'busy']);
    });

    /**
     * Tests the executeOperation wrapper.
     * Verifies that the coordinator correctly executes a function while
     * tracking it as a managed operation.
     */
    it('should execute operations and track them', async () => {
        const operation = jest.fn().mockResolvedValue('result');
        const result = await coordinator.executeOperation(operation, 'test_op');

        expect(result).toBe('result');
        expect(operation).toHaveBeenCalled();
    });

    /**
     * Tests concurrency management during reloads.
     * Verifies that a reload request waits for any long-running operations
     * to finish before transitioning the system to the RELOADING state.
     */
    it('should wait for pending operations during reload', async () => {
        let opFinished = false;
        const operation = async () => {
            await new Promise(r => setTimeout(r, 50));
            opFinished = true;
            return 'ok';
        };

        await coordinator.emitEvent(EventType.EXTENSION_READY);

        // Start an operation but don't await it yet
        const opPromise = coordinator.executeOperation(operation, 'long_op');

        // Start reload - it should wait for operation
        await coordinator.emitEvent(EventType.RELOAD_REQUESTED);

        expect(opFinished).toBe(true);
        await opPromise;
    });

    /**
     * Tests the robustness of the event processing loop.
     * Verifies that if an event handler throws an error, it is correctly
     * bubbled up to the caller but doesn't leave the coordinator in an invalid state.
     */
    it('should handle errors in handlers without crashing', async () => {
        // Since I changed processEventQueue to throw, I need to update this test
        // if I want it to "not crash the coordinator" but notify the caller.
        coordinator.on(EventType.EXTENSION_READY, () => {
            throw new Error('Handler crash');
        });

        // It SHOULD throw now because I changed it to re-throw
        await expect(coordinator.emitEvent(EventType.EXTENSION_READY))
            .rejects.toThrow('Handler crash');

        // But the coordinator should still be in a valid (if old) state
        // Actually handleEvent calls setState BEFORE the handler.
        // So it's in READY state.
        expect(coordinator.getState()).toBe(ExtensionState.READY);
    });

    /**
     * Tests the cleanup logic.
     * Verifies that disposing the coordinator removes all event listeners
     * to prevent memory leaks and unintended side effects.
     */
    it('should dispose correctly', () => {
        const handler = jest.fn();
        coordinator.on('test', handler);
        coordinator.dispose();

        coordinator.emit('test');
        expect(handler).not.toHaveBeenCalled();
    });
});
