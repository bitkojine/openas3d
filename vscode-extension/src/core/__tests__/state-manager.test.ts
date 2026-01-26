/**
 * Tests for StateManager - Thread-safe state persistence
 */

import { StateManager, StateConfig } from '../state-manager';
import { LifecycleCoordinator, EventType } from '../lifecycle-coordinator';

// Mock VSCode context
const createMockContext = () => ({
    globalState: {
        get: jest.fn(),
        update: jest.fn()
    },
    workspaceState: {
        get: jest.fn(),
        update: jest.fn()
    }
});

describe('StateManager', () => {
    let stateManager: StateManager;
    let coordinator: LifecycleCoordinator;
    let mockContext: any;

    beforeEach(() => {
        coordinator = new LifecycleCoordinator();
        mockContext = createMockContext();
        stateManager = new StateManager(mockContext, coordinator);
        jest.clearAllMocks();
    });

    afterEach(() => {
        coordinator.removeAllListeners();
    });

    describe('State Persistence', () => {
        it('should save state to global storage', async () => {
            const config: StateConfig = {
                key: 'test.key',
                scope: 'global'
            };
            const testData = { message: 'test data' };

            await stateManager.saveState(config, testData);

            expect(mockContext.globalState.update).toHaveBeenCalledWith(
                'test.key',
                expect.objectContaining({
                    version: '1.0',
                    timestamp: expect.any(Number),
                    data: testData,
                    checksum: expect.any(String)
                })
            );
        });

        it('should save state to workspace storage', async () => {
            const config: StateConfig = {
                key: 'test.workspace',
                scope: 'workspace'
            };
            const testData = { message: 'workspace data' };

            await stateManager.saveState(config, testData);

            expect(mockContext.workspaceState.update).toHaveBeenCalledWith(
                'test.workspace',
                expect.objectContaining({
                    version: '1.0',
                    timestamp: expect.any(Number),
                    data: testData,
                    checksum: expect.any(String)
                })
            );
        });

        it('should validate data size before saving', async () => {
            const config: StateConfig = {
                key: 'test.large',
                scope: 'global',
                maxSize: 100 // Very small limit
            };
            const largeData = 'x'.repeat(200); // Exceeds limit

            await expect(stateManager.saveState(config, largeData))
                .rejects.toThrow('State data exceeds maximum size');
        });

        it('should deduplicate concurrent save operations', async () => {
            const config: StateConfig = {
                key: 'test.concurrent',
                scope: 'global'
            };
            const testData1 = { version: 1 };
            const testData2 = { version: 2 };

            // Start two concurrent saves
            const save1 = stateManager.saveState(config, testData1);
            const save2 = stateManager.saveState(config, testData2);

            await Promise.all([save1, save2]);

            // Should only call update once (deduplication)
            expect(mockContext.globalState.update).toHaveBeenCalledTimes(1);
        });
    });

    describe('State Loading', () => {
        it('should load state from global storage', async () => {
            const config: StateConfig = {
                key: 'test.load',
                scope: 'global'
            };
            const expectedData = { message: 'loaded data' };
            
            // Create a proper snapshot with valid checksum using the same algorithm
            const serialized = JSON.stringify(expectedData);
            const checksum = calculateChecksum(serialized);
            
            const snapshot = {
                version: '1.0',
                timestamp: Date.now(),
                data: expectedData,
                checksum
            };

            // Reset and properly mock the get method
            mockContext.globalState.get.mockClear();
            mockContext.globalState.get.mockReturnValue(snapshot);

            const result = await stateManager.loadState(config);

            expect(result).toEqual(expectedData);
            expect(mockContext.globalState.get).toHaveBeenCalledWith('test.load');
        });

        // Helper function to match the checksum algorithm in StateManager
        function calculateChecksum(data: string): string {
            let hash = 0;
            for (let i = 0; i < data.length; i++) {
                const char = data.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return hash.toString(16);
        }

        it('should return undefined for missing state', async () => {
            const config: StateConfig = {
                key: 'test.missing',
                scope: 'global'
            };

            mockContext.globalState.get.mockReturnValue(undefined);

            const result = await stateManager.loadState(config);

            expect(result).toBeUndefined();
        });

        it('should validate snapshot TTL', async () => {
            const config: StateConfig = {
                key: 'test.expired',
                scope: 'global',
                ttl: 1000 // 1 second TTL
            };
            const expiredSnapshot = {
                version: '1.0',
                timestamp: Date.now() - 2000, // 2 seconds ago
                data: { message: 'expired' },
                checksum: 'abc123'
            };

            mockContext.globalState.get.mockReturnValue(expiredSnapshot);

            const result = await stateManager.loadState(config);

            expect(result).toBeUndefined();
            expect(mockContext.globalState.update).toHaveBeenCalledWith('test.expired', undefined);
        });

        it('should validate checksum integrity', async () => {
            const config: StateConfig = {
                key: 'test.corrupted',
                scope: 'global'
            };
            const corruptedSnapshot = {
                version: '1.0',
                timestamp: Date.now(),
                data: { message: 'corrupted' },
                checksum: 'invalid_checksum'
            };

            mockContext.globalState.get.mockReturnValue(corruptedSnapshot);

            const result = await stateManager.loadState(config);

            expect(result).toBeUndefined();
            expect(mockContext.globalState.update).toHaveBeenCalledWith('test.corrupted', undefined);
        });
    });

    describe('State Clearing', () => {
        it('should clear state from global storage', async () => {
            const config: StateConfig = {
                key: 'test.clear',
                scope: 'global'
            };

            await stateManager.clearState(config);

            expect(mockContext.globalState.update).toHaveBeenCalledWith('test.clear', undefined);
        });

        it('should clear state from workspace storage', async () => {
            const config: StateConfig = {
                key: 'test.clear.workspace',
                scope: 'workspace'
            };

            await stateManager.clearState(config);

            expect(mockContext.workspaceState.update).toHaveBeenCalledWith('test.clear.workspace', undefined);
        });
    });

    describe('Lifecycle Coordination', () => {
        it('should skip saves during reload', async () => {
            const config: StateConfig = {
                key: 'test.reload.skip',
                scope: 'global'
            };
            const testData = { message: 'should be skipped' };

            // Set coordinator to reloading state
            await coordinator.emitEvent(EventType.EXTENSION_READY);
            await coordinator.emitEvent(EventType.RELOAD_REQUESTED);

            // Clear the mock to track only this save operation
            mockContext.globalState.update.mockClear();

            await stateManager.saveState(config, testData);

            // Should not have called update for the specific key, but might have called for snapshot
            expect(mockContext.globalState.update).not.toHaveBeenCalledWith(
                'test.reload.skip',
                expect.any(Object)
            );
        });

        it('should create snapshot during state saving event', async () => {
            const config: StateConfig = {
                key: 'test.snapshot',
                scope: 'global'
            };
            const testData = { message: 'snapshot data' };

            // Listen for snapshot creation
            const snapshotPromise = new Promise<any>((resolve) => {
                mockContext.globalState.update.mockImplementation((key: any, value: any) => {
                    if (key === 'openas3d.completeSnapshot') {
                        resolve(value);
                    }
                    return Promise.resolve();
                });
            });

            // Trigger state saving
            await coordinator.emitEvent(EventType.STATE_SAVING);

            const snapshot = await snapshotPromise;
            expect(snapshot).toBeDefined();
            expect(snapshot.timestamp).toBeGreaterThan(0);
            expect(snapshot.snapshots).toBeDefined();
            expect(typeof snapshot.snapshots).toBe('object');
        });

        it('should restore from snapshot during state loading event', async () => {
            const completeSnapshot = {
                timestamp: Date.now(),
                snapshots: {
                    'test.restore': {
                        version: '1.0',
                        timestamp: Date.now(),
                        data: { message: 'restored data' },
                        checksum: 'abc123'
                    }
                }
            };

            mockContext.globalState.get.mockImplementation((key: string) => {
                if (key === 'openas3d.completeSnapshot') {
                    return completeSnapshot;
                }
                return undefined;
            });

            // Trigger state loading
            await coordinator.emitEvent(EventType.STATE_LOADING);

            // Verify the snapshot was processed
            expect(mockContext.globalState.get).toHaveBeenCalledWith('openas3d.completeSnapshot');
        });
    });

    describe('Error Handling', () => {
        it('should handle save errors gracefully', async () => {
            const config: StateConfig = {
                key: 'test.error.save',
                scope: 'global'
            };
            const testData = { message: 'error test' };

            // Mock the update method to throw an error
            mockContext.globalState.update.mockImplementation(() => {
                throw new Error('Storage error');
            });

            await expect(stateManager.saveState(config, testData))
                .rejects.toThrow('Storage error');
        });

        it('should handle load errors gracefully', async () => {
            const config: StateConfig = {
                key: 'test.error.load',
                scope: 'global'
            };

            // Mock the get method to throw an error
            mockContext.globalState.get.mockImplementation(() => {
                throw new Error('Load error');
            });

            const result = await stateManager.loadState(config);

            expect(result).toBeUndefined();
        });
    });

    describe('Statistics', () => {
        it('should provide accurate statistics', async () => {
            const config1: StateConfig = { key: 'test.stats1', scope: 'global' };
            const config2: StateConfig = { key: 'test.stats2', scope: 'workspace' };

            // Save some states
            await stateManager.saveState(config1, { data: 'small' });
            await stateManager.saveState(config2, { data: 'larger data set' });

            const stats = stateManager.getStats();

            expect(stats.totalKeys).toBe(2);
            expect(stats.totalSize).toBeGreaterThan(0);
            expect(stats.pendingSaves).toBe(0);
        });
    });

    describe('Checksum Calculation', () => {
        it('should generate consistent checksums', async () => {
            const config: StateConfig = {
                key: 'test.checksum',
                scope: 'global'
            };
            const testData = { message: 'checksum test' };

            await stateManager.saveState(config, testData);

            const saveCall = mockContext.globalState.update.mock.calls[0];
            const snapshot = saveCall[1];

            expect(snapshot.checksum).toBeDefined();
            expect(typeof snapshot.checksum).toBe('string');
            expect(snapshot.checksum.length).toBeGreaterThan(0);

            // Save again with same data - should get same checksum
            await stateManager.saveState(config, testData);

            const secondSaveCall = mockContext.globalState.update.mock.calls[1];
            const secondSnapshot = secondSaveCall[1];

            expect(secondSnapshot.checksum).toBe(snapshot.checksum);

            // Save with different data - should get different checksum
            await stateManager.saveState(config, { message: 'different data' });

            const thirdSaveCall = mockContext.globalState.update.mock.calls[2];
            const thirdSnapshot = thirdSaveCall[1];

            expect(thirdSnapshot.checksum).not.toBe(snapshot.checksum);
        });
    });
});
