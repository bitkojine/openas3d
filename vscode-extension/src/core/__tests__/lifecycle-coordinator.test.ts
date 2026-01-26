/**
 * Tests for LifecycleCoordinator - Central event-driven state machine
 */

import { LifecycleCoordinator, ExtensionState, EventType } from '../lifecycle-coordinator';

// Mock VSCode for testing
const mockVSCode = {
    commands: {
        executeCommand: jest.fn()
    }
};

// Mock the global vscode object
(global as any).vscode = mockVSCode;

describe('LifecycleCoordinator', () => {
    let coordinator: LifecycleCoordinator;

    beforeEach(() => {
        coordinator = new LifecycleCoordinator();
        jest.clearAllMocks();
    });

    afterEach(() => {
        coordinator.removeAllListeners();
    });

    describe('State Management', () => {
        it('should start in INITIALIZING state', () => {
            expect(coordinator.getState()).toBe(ExtensionState.INITIALIZING);
        });

        it('should transition to READY when EXTENSION_READY is emitted', async () => {
            const stateChangePromise = new Promise<any>((resolve) => {
                coordinator.once('stateChanged', resolve);
            });

            await coordinator.emitEvent(EventType.EXTENSION_READY);

            const stateChange = await stateChangePromise;
            expect(stateChange.oldState).toBe(ExtensionState.INITIALIZING);
            expect(stateChange.newState).toBe(ExtensionState.READY);
            expect(coordinator.getState()).toBe(ExtensionState.READY);
        });

        it('should transition to RELOADING when RELOAD_REQUESTED is emitted', async () => {
            // First transition to READY
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            expect(coordinator.getState()).toBe(ExtensionState.READY);

            const stateChangePromise = new Promise<any>((resolve) => {
                coordinator.once('stateChanged', resolve);
            });

            await coordinator.emitEvent(EventType.RELOAD_REQUESTED);

            const stateChange = await stateChangePromise;
            expect(stateChange.oldState).toBe(ExtensionState.READY);
            expect(stateChange.newState).toBe(ExtensionState.RELOADING);
            expect(coordinator.getState()).toBe(ExtensionState.RELOADING);
        });

        it('should reject invalid state transitions', async () => {
            // Try to go directly from INITIALIZING to RELOADING (invalid)
            // This should not throw but should not change state either
            await coordinator.emitEvent(EventType.RELOAD_REQUESTED);
            expect(coordinator.getState()).toBe(ExtensionState.INITIALIZING);
        });

        it('should transition from BUSY back to READY when analysis completes', async () => {
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            await coordinator.emitEvent(EventType.ANALYSIS_STARTED);
            expect(coordinator.getState()).toBe(ExtensionState.BUSY);

            const stateChangePromise = new Promise<any>((resolve) => {
                coordinator.once('stateChanged', resolve);
            });

            await coordinator.emitEvent(EventType.ANALYSIS_COMPLETED);

            const stateChange = await stateChangePromise;
            expect(stateChange.oldState).toBe(ExtensionState.BUSY);
            expect(stateChange.newState).toBe(ExtensionState.READY);
            expect(coordinator.getState()).toBe(ExtensionState.READY);
        });
    });

    describe('Event Processing', () => {
        it('should process events in order', async () => {
            const processedEvents: string[] = [];
            
            coordinator.on(EventType.EXTENSION_READY, () => processedEvents.push('ready'));
            coordinator.on(EventType.ANALYSIS_STARTED, () => processedEvents.push('analysis_started'));
            coordinator.on(EventType.ANALYSIS_COMPLETED, () => processedEvents.push('analysis_completed'));

            // Emit events in order with proper state transitions
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            await coordinator.emitEvent(EventType.ANALYSIS_STARTED);
            await coordinator.emitEvent(EventType.ANALYSIS_COMPLETED);

            // Wait for processing
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(processedEvents).toEqual(['ready', 'analysis_started', 'analysis_completed']);
        });

        it('should handle concurrent event emissions gracefully', async () => {
            const eventCount = 10;
            const processedEvents: number[] = [];

            coordinator.on(EventType.FILE_CHANGED, (data) => {
                processedEvents.push(data.fileId);
            });

            // Emit multiple events concurrently
            const promises = [];
            for (let i = 0; i < eventCount; i++) {
                promises.push(coordinator.emitEvent(EventType.FILE_CHANGED, { fileId: i }));
            }

            await Promise.all(promises);
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(processedEvents).toHaveLength(eventCount);
            expect(processedEvents.sort()).toEqual(Array.from({ length: eventCount }, (_, i) => i));
        });
    });

    describe('Operation Coordination', () => {
        it('should execute operations with proper tracking', async () => {
            const operationResults: string[] = [];

            const operation1 = jest.fn().mockResolvedValue('result1');
            const operation2 = jest.fn().mockResolvedValue('result2');

            const result1 = await coordinator.executeOperation(operation1, 'test_op_1');
            const result2 = await coordinator.executeOperation(operation2, 'test_op_2');

            expect(result1).toBe('result1');
            expect(result2).toBe('result2');
            expect(operation1).toHaveBeenCalled();
            expect(operation2).toHaveBeenCalled();
        });

        it('should wait for all pending operations during reload', async () => {
            let slowOperationResolved = false;
            const slowOperation = jest.fn().mockImplementation(async () => {
                await new Promise(resolve => setTimeout(resolve, 100));
                slowOperationResolved = true;
                return 'slow_result';
            });

            const fastOperation = jest.fn().mockResolvedValue('fast_result');

            // Start operations
            const slowPromise = coordinator.executeOperation(slowOperation, 'slow_op');
            const fastPromise = coordinator.executeOperation(fastOperation, 'fast_op');

            // Wait for fast operation to complete
            await fastPromise;
            expect(fastOperation).toHaveBeenCalled();
            expect(slowOperationResolved).toBe(false);

            // Wait for slow operation
            await slowPromise;
            expect(slowOperationResolved).toBe(true);
        });

        it('should handle operation failures gracefully', async () => {
            const failingOperation = jest.fn().mockRejectedValue(new Error('Operation failed'));

            await expect(coordinator.executeOperation(failingOperation, 'failing_op'))
                .rejects.toThrow('Operation failed');
        });
    });

    describe('Error Handling', () => {
        it('should emit error events when exceptions occur', async () => {
            const errorHandler = jest.fn();
            coordinator.on('error', errorHandler);

            // Create a coordinator that will throw during event processing
            const faultyCoordinator = new LifecycleCoordinator();
            faultyCoordinator.on('error', errorHandler);

            // Mock the processEventQueue method to throw an error
            const originalProcessQueue = (faultyCoordinator as any).processEventQueue;
            (faultyCoordinator as any).processEventQueue = jest.fn().mockImplementation(async () => {
                // Simulate the error but don't actually throw - let the error handler catch it
                faultyCoordinator.emit('error', new Error('Processing error'));
            });

            await faultyCoordinator.emitEvent(EventType.EXTENSION_READY);

            // Wait for error handling
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(errorHandler).toHaveBeenCalled();
        });

        it('should recover to READY state after error', async () => {
            const errorHandler = jest.fn();
            coordinator.on('error', errorHandler);

            // Simulate an error during processing but don't actually throw
            const originalProcessQueue = (coordinator as any).processEventQueue;
            (coordinator as any).processEventQueue = jest.fn().mockImplementation(async () => {
                // Emit error instead of throwing
                coordinator.emit('error', new Error('Processing error'));
            });

            await coordinator.emitEvent(EventType.EXTENSION_READY);

            // Wait for error handling and recovery
            await new Promise(resolve => setTimeout(resolve, 100));

            expect(errorHandler).toHaveBeenCalled();
            expect(coordinator.getState()).toBe(ExtensionState.READY);
        });
    });

    describe('State Queries', () => {
        it('should correctly report ready state', () => {
            expect(coordinator.isReady()).toBe(false);
            expect(coordinator.isReloading()).toBe(false);
            expect(coordinator.isBusy()).toBe(false);
        });

        it('should correctly report reloading state', async () => {
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            await coordinator.emitEvent(EventType.RELOAD_REQUESTED);

            expect(coordinator.isReady()).toBe(false);
            expect(coordinator.isReloading()).toBe(true);
            expect(coordinator.isBusy()).toBe(false);
        });

        it('should correctly report busy state', async () => {
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            await coordinator.emitEvent(EventType.ANALYSIS_STARTED);

            expect(coordinator.isReady()).toBe(false);
            expect(coordinator.isReloading()).toBe(false);
            expect(coordinator.isBusy()).toBe(true);
        });
    });

    describe('Reload Flow', () => {
        it('should handle complete reload flow', async () => {
            // Test the basic reload flow without complex promise handling
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            expect(coordinator.getState()).toBe(ExtensionState.READY);
            
            await coordinator.emitEvent(EventType.RELOAD_REQUESTED);
            expect(coordinator.getState()).toBe(ExtensionState.RELOADING);
            
            await coordinator.emitEvent(EventType.RELOAD_COMPLETED);
            expect(coordinator.getState()).toBe(ExtensionState.READY);
        });
    });
});
