throw new Error("Mock Sabotaged! This test uses mocking (jest.mock, jest.fn, or jest.spyOn).");

/**
 * Tests for DescriptionSyncService
 * 
 * Verifies that the service correctly:
 * - Watches for file changes
 * - Extracts descriptions from .md files
 * - Generates descriptions for code files
 * - Sends updates to webview
 */

import { DescriptionSyncService } from '../description-sync-service';
import { ExtensionMessage } from '../../shared/messages';
import * as vscode from 'vscode';

// Mock vscode module
jest.mock('vscode', () => {
    const RelativePattern = jest.fn().mockImplementation((folder, pattern) => ({
        base: folder,
        pattern: pattern
    }));

    const Uri = {
        file: jest.fn((path: string) => ({ fsPath: path }))
    };

    return {
        RelativePattern,
        Uri,
        workspace: {
            workspaceFolders: [
                { uri: { fsPath: '/workspace' } }
            ],
            createFileSystemWatcher: jest.fn(),
            openTextDocument: jest.fn(),
            fs: {
                stat: jest.fn()
            }
        }
    };
});

describe('DescriptionSyncService', () => {
    let service: DescriptionSyncService;
    let sendUpdateSpy: jest.Mock;
    let mockWatcher: any;

    beforeEach(() => {
        sendUpdateSpy = jest.fn();
        service = new DescriptionSyncService(sendUpdateSpy);

        mockWatcher = {
            onDidCreate: jest.fn(),
            onDidChange: jest.fn(),
            onDidDelete: jest.fn(),
            dispose: jest.fn()
        };

        (vscode.workspace.createFileSystemWatcher as jest.Mock).mockReturnValue(mockWatcher);
    });

    describe('file watching', () => {
        it('should start watching when startWatching is called', () => {
            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            expect(vscode.workspace.createFileSystemWatcher).toHaveBeenCalled();
            expect(mockWatcher.onDidCreate).toHaveBeenCalled();
            expect(mockWatcher.onDidChange).toHaveBeenCalled();
            expect(mockWatcher.onDidDelete).toHaveBeenCalled();
        });

        it('should stop watching when stopWatching is called', () => {
            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);
            service.stopWatching();

            expect(mockWatcher.dispose).toHaveBeenCalled();
        });

        it('should not start watching if no workspace folders', () => {
            const originalFolders = vscode.workspace.workspaceFolders;
            (vscode.workspace as any).workspaceFolders = undefined;

            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            expect(vscode.workspace.createFileSystemWatcher).not.toHaveBeenCalled();

            (vscode.workspace as any).workspaceFolders = originalFolders;
        });
    });

    describe('description extraction', () => {
        it('should extract description from .md file', async () => {
            const mockDoc = {
                getText: () => `---
status: reconciled
---

# Test File
## Summary
This is a test summary
`
            };

            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDoc);

            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            // Simulate file change
            const changeHandler = mockWatcher.onDidChange.mock.calls[0][0];
            await changeHandler({ fsPath: '/workspace/test.md' });

            expect(sendUpdateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'updateObjectDescription',
                    data: expect.objectContaining({
                        filePath: '/workspace/test.md',
                        description: expect.objectContaining({
                            summary: 'This is a test summary',
                            status: 'reconciled'
                        })
                    })
                })
            );
        });

        it('should generate description for code file when .md not found', async () => {
            const mockStats = {
                size: 1000,
                mtime: Date.now()
            };

            // Mock the stat to return stats for the code file
            // When a .ts file is passed, extractDescription will:
            // 1. Check if it's a .md file (false for .ts)
            // 2. Since no summaryText, it tries to generate from code file
            // 3. It does: filePath = uri.fsPath.replace(/\.md$/, '') which doesn't change .ts
            // 4. Creates codeUri = vscode.Uri.file(filePath) which creates { fsPath: '/workspace/test.ts' }
            // 5. Calls fs.stat(codeUri) which should return the mockStats
            (vscode.workspace.fs.stat as jest.Mock).mockResolvedValue(mockStats);

            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            // Simulate code file change (not .md)
            const changeHandler = mockWatcher.onDidChange.mock.calls[0][0];
            const uri = { fsPath: '/workspace/test.ts' };
            await changeHandler(uri);

            // Wait for async operations to complete
            await new Promise(resolve => setTimeout(resolve, 50));

            expect(sendUpdateSpy).toHaveBeenCalled();
            const call = sendUpdateSpy.mock.calls[0][0];
            expect(call.data.description.status).toBe('generated');
            expect(call.data.description.summary).toContain('Filename: test.ts');
        });

        it('should handle file deletion', () => {
            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            // Simulate file deletion
            const deleteHandler = mockWatcher.onDidDelete.mock.calls[0][0];
            deleteHandler({ fsPath: '/workspace/test.md' });

            expect(sendUpdateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'updateObjectDescription',
                    data: {
                        filePath: '/workspace/test.md',
                        description: {
                            summary: 'No description yet.',
                            status: 'missing'
                        }
                    }
                })
            );
        });
    });

    describe('error handling', () => {
        it('should handle errors when reading files', async () => {
            // Mock openTextDocument to throw an error
            (vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(new Error('File not found'));
            // Also mock fs.stat to throw so the fallback path also fails
            (vscode.workspace.fs.stat as jest.Mock).mockRejectedValue(new Error('File not found'));

            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            const changeHandler = mockWatcher.onDidChange.mock.calls[0][0];
            
            // The error is caught internally and returns a description with "No description available"
            // So we should still get an update, just with a fallback description
            await changeHandler({ fsPath: '/workspace/test.md' });

            // Wait for async operations
            await new Promise(resolve => setTimeout(resolve, 10));

            // Should still send an update even when errors occur
            expect(sendUpdateSpy).toHaveBeenCalled();
            const call = sendUpdateSpy.mock.calls[0][0];
            expect(call.data.description.summary).toBe('No description available');
        });
    });
});
