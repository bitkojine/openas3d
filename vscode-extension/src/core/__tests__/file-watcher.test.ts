import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FileWatcher, FileWatcherConfig } from '../file-watcher';
import { LifecycleCoordinator, EventType } from '../lifecycle-coordinator';
import { ErrorRecoverySystem, ErrorCategory, ErrorSeverity } from '../error-recovery';

// Define the mock watcher object
const createMockWatcher = () => ({
    onDidCreate: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidChange: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    onDidDelete: jest.fn().mockReturnValue({ dispose: jest.fn() }),
    dispose: jest.fn()
});

jest.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [{ uri: { fsPath: '/mock/workspace' } }],
        createFileSystemWatcher: jest.fn().mockImplementation(() => createMockWatcher()),
        fs: {
            stat: jest.fn().mockResolvedValue({})
        }
    },
    Uri: {
        file: jest.fn(path => ({ fsPath: path, scheme: 'file' })),
        parse: jest.fn(str => ({ fsPath: str, scheme: 'file' }))
    },
    RelativePattern: jest.fn().mockImplementation((base, pattern) => ({ base, pattern })),
    Disposable: jest.fn()
}), { virtual: true });

jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    watch: jest.fn().mockReturnValue({ close: jest.fn() }),
    statSync: jest.fn().mockReturnValue({ isDirectory: () => false })
}));

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

describe('FileWatcher', () => {
    let fileWatcher: FileWatcher;
    let mockCoordinator: LifecycleCoordinator;
    let mockErrorRecovery: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        mockCoordinator = new LifecycleCoordinator();
        mockErrorRecovery = {
            reportError: jest.fn().mockResolvedValue(undefined)
        };

        const config: FileWatcherConfig = {
            patterns: ['**/*.ts'],
            debounceMs: 50
        };

        fileWatcher = new FileWatcher(config, mockCoordinator, mockErrorRecovery as any);
        await mockCoordinator.emitEvent(EventType.EXTENSION_READY);
    });

    afterEach(() => {
        fileWatcher.dispose();
    });

    /**
     * Tests that start() correctly initializes the VS Code file system watcher
     * for the specified workspace path.
     */
    it('should start watching using VSCode API', async () => {
        await fileWatcher.start('/mock/workspace');
        expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
    });

    /**
     * Tests the debouncing logic in the file watcher.
     * Verifies that multiple rapid file system events for different files (or the same)
     * are collected and result in a single notification to the system coordinator
     * to prevent excessive processing.
     */
    it('should debounce and emit events', async () => {
        const events: any[] = [];
        mockCoordinator.on(EventType.FILE_CHANGED, (e) => events.push(e));

        await fileWatcher.start('/mock/workspace');
        const watcher = (vscode.workspace.createFileSystemWatcher as jest.Mock).mock.results[0].value;
        const createCallback = watcher.onDidCreate.mock.calls[0][0];

        // Advance timers manually
        jest.useFakeTimers();

        createCallback({ fsPath: '/mock/workspace/file1.ts' });
        createCallback({ fsPath: '/mock/workspace/file2.ts' });

        jest.advanceTimersByTime(100);

        // This is the trick: await a promise that resolves on the next tick
        // And then another to let the coordinator finish
        await Promise.resolve();
        await Promise.resolve();

        expect(events.length).toBe(1);
        jest.useRealTimers();
    });

    /**
     * Tests the pause/resume capability during system reloads.
     * Verifies that file events are queued while a reload is in progress and
     * are correctly processed once the reload completes, ensuring no file changes
     * are missed during maintenance periods.
     */
    it('should pause and resume events', async () => {
        const events: any[] = [];
        mockCoordinator.on(EventType.FILE_CHANGED, (e) => events.push(e));

        await fileWatcher.start('/mock/workspace');
        const watcher = (vscode.workspace.createFileSystemWatcher as jest.Mock).mock.results[0].value;
        const createCallback = watcher.onDidCreate.mock.calls[0][0];

        // Pause by triggering reload
        await mockCoordinator.emitEvent(EventType.RELOAD_REQUESTED);

        // Use fake timers for the debounce logic in queueEvent
        jest.useFakeTimers();
        createCallback({ fsPath: '/mock/workspace/file1.ts' });

        jest.advanceTimersByTime(100);
        await Promise.resolve();

        expect(events.length).toBe(0);

        // Trigger resume
        await mockCoordinator.emitEvent(EventType.RELOAD_COMPLETED);

        // resume() calls processEventQueue immediately if queue > 0
        // No timers involved in resume -> processEventQueue path
        await Promise.resolve();
        await Promise.resolve();

        expect(events.length).toBe(1);
        jest.useRealTimers();
    });

    /**
     * Tests the cleanup logic.
     * Verifies that disposing the FileWatcher properly disposes of all underlying
     * VS Code file system watchers to avoid resource leaks.
     */
    it('should dispose watchers on dispose()', async () => {
        await fileWatcher.start('/mock/workspace');
        const watcher = (vscode.workspace.createFileSystemWatcher as jest.Mock).mock.results[0].value;

        fileWatcher.dispose();
        expect(watcher.dispose).toHaveBeenCalled();
    });
});
