import * as vscode from 'vscode';
import { StateManager, StateConfig, StateSnapshot } from '../state-manager';
import { LifecycleCoordinator, EventType } from '../lifecycle-coordinator';
import { ErrorRecoverySystem, ErrorCategory, ErrorSeverity } from '../error-recovery';

jest.mock('vscode', () => ({
    ExtensionContext: jest.fn(),
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

describe('StateManager', () => {
    let stateManager: StateManager;
    let mockContext: any;
    let mockCoordinator: LifecycleCoordinator;
    let mockErrorRecovery: any;
    let mockGlobalState: any;
    let mockWorkspaceState: any;

    beforeEach(async () => {
        jest.clearAllMocks();

        mockGlobalState = {
            get: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined)
        };
        mockWorkspaceState = {
            get: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined)
        };

        mockContext = {
            globalState: mockGlobalState,
            workspaceState: mockWorkspaceState
        };

        mockCoordinator = new LifecycleCoordinator();
        mockErrorRecovery = {
            reportError: jest.fn().mockResolvedValue(undefined)
        };

        stateManager = new StateManager(mockContext, mockCoordinator, mockErrorRecovery as any);

        // Ensure ready state for most tests
        await mockCoordinator.emitEvent(EventType.EXTENSION_READY);
    });

    const defaultConfig: StateConfig = {
        key: 'testKey',
        scope: 'global'
    };

    /**
     * Tests the primary state saving functionality.
     * Verifies that data is correctly routed to VS Code's global storage
     * with appropriate metadata (version, etc).
     */
    it('should save state to global storage', async () => {
        const data = { foo: 'bar' };
        await stateManager.saveState(defaultConfig, data);

        expect(mockGlobalState.update).toHaveBeenCalledWith('testKey', expect.objectContaining({
            data,
            version: '1.0'
        }));
    });

    /**
     * Tests the state retrieval functionality.
     */
    it('should load state from global storage', async () => {
        const data = { foo: 'bar' };
        mockGlobalState.get.mockReturnValue({
            data,
            version: '1.0',
            timestamp: Date.now()
        });

        const loaded = await stateManager.loadState<any>(defaultConfig);
        expect(loaded).toEqual(data);
    });

    /**
     * Tests data integrity protection.
     * Verifies that if stored state has an invalid checksum, the system
     * treats it as missing and clears the corrupted entry.
     */
    it('should validate checksum on load', async () => {
        const data = { foo: 'bar' };
        mockGlobalState.get.mockReturnValue({
            data,
            version: '1.0',
            timestamp: Date.now(),
            checksum: 'wrong'
        });

        const loaded = await stateManager.loadState<any>(defaultConfig);
        expect(loaded).toBeUndefined();
        expect(mockGlobalState.update).toHaveBeenCalledWith('testKey', undefined); // Cleared due to invalid checksum
    });

    /**
     * Tests temporary state handling.
     * Verifies that state entries older than their configured Time-To-Live (TTL)
     * are automatically expired and treated as missing.
     */
    it('should respect TTL', async () => {
        const data = { foo: 'bar' };
        const expiredTime = Date.now() - 10000;
        mockGlobalState.get.mockReturnValue({
            data,
            timestamp: expiredTime
        });

        const configWithTTL: StateConfig = { ...defaultConfig, ttl: 1000 };
        const loaded = await stateManager.loadState<any>(configWithTTL);
        expect(loaded).toBeUndefined();
    });

    /**
     * Tests protection against excessive storage use.
     * Verifies that attempt to save data exceeding the configured maxSize
     * for a particular key is blocked.
     */
    it('should enforce maxSize', async () => {
        const largeData = 'a'.repeat(200);
        const configWithLimit: StateConfig = { ...defaultConfig, maxSize: 100 };

        await expect(stateManager.saveState(configWithLimit, largeData))
            .rejects.toThrow('State data exceeds maximum size');
    });

    /**
     * Tests error reporting for storage failures.
     * Verifies that if VS Code's storage API fails, the error is caught
     * and reported to the system's ErrorRecoverySystem.
     */
    it('should report errors to ErrorRecoverySystem', async () => {
        const error = new Error('Storage failed');
        mockGlobalState.update.mockRejectedValue(error);

        await expect(stateManager.saveState(defaultConfig, { test: 1 }))
            .rejects.toThrow('Storage failed');

        expect(mockErrorRecovery.reportError).toHaveBeenCalledWith(
            ErrorCategory.STATE_MANAGEMENT,
            ErrorSeverity.MEDIUM,
            expect.any(String),
            expect.objectContaining({ error })
        );
    });

    /**
     * Tests state locking during maintenance.
     * Verifies that new save operations are ignored while a system reload
     * is in progress to prevent inconsistent states.
     */
    it('should skip saves during reload', async () => {
        await mockCoordinator.emitEvent(EventType.RELOAD_REQUESTED);

        await stateManager.saveState(defaultConfig, { foo: 'bar' });
        // Should not have updated the specific key
        expect(mockGlobalState.update).not.toHaveBeenCalledWith(defaultConfig.key, expect.anything());
    });

    /**
     * Tests persistence during reloads.
     * Verifies that the system waits for any pending save operations to
     * complete before proceeding with a reload.
     */
    it('should flush pending saves on reload', async () => {
        let saveFinished = false;
        mockGlobalState.update.mockImplementation(async (key: string) => {
            if (key === defaultConfig.key) {
                await new Promise(r => setTimeout(r, 50));
                saveFinished = true;
            }
        });

        // Start save
        const savePromise = stateManager.saveState(defaultConfig, { foo: 'bar' });

        // Trigger reload - it should wait for save
        await mockCoordinator.emitEvent(EventType.RELOAD_REQUESTED);

        expect(saveFinished).toBe(true);
        await savePromise;
    });

    /**
     * Tests the aggregate snapshotting mechanism used for system-wide
     * state backups.
     */
    it('should create complete snapshot', async () => {
        await stateManager.saveState(defaultConfig, { data: 1 });
        await mockCoordinator.emitEvent(EventType.STATE_SAVING);

        expect(mockGlobalState.update).toHaveBeenCalledWith('openas3d.completeSnapshot', expect.objectContaining({
            snapshots: expect.any(Object)
        }));
    });

    /**
     * Tests recovery from an aggregate snapshot.
     */
    it('should restore from snapshot', async () => {
        mockGlobalState.get.mockImplementation((key: string) => {
            if (key === 'openas3d.completeSnapshot') {
                return {
                    snapshots: {
                        testKey: { data: 'restored', timestamp: Date.now(), version: '1.0' }
                    }
                };
            }
            return null;
        });

        await mockCoordinator.emitEvent(EventType.STATE_LOADING);

        const loaded = await stateManager.loadState<any>(defaultConfig);
        expect(loaded).toBe('restored');
    });

    /**
     * Tests the cleanup logic.
     */
    it('should dispose correctly', () => {
        stateManager.dispose();
        // Should not crash when called
        expect(stateManager.getStats().totalKeys).toBe(0);
    });
});
