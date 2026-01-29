throw new Error("Mock Sabotaged! This test uses mocking (jest.mock, jest.fn, or jest.spyOn).");

/**
 * Tests for EditorConfigService
 * 
 * Verifies that the service correctly:
 * - Watches for config changes
 * - Sends initial config
 * - Sends updates when config changes
 */

import { EditorConfigService } from '../editor-config-service';
import { ExtensionMessage } from '../../shared/messages';
import * as vscode from 'vscode';

// Mock vscode module
jest.mock('vscode', () => ({
    workspace: {
        getConfiguration: jest.fn(),
        onDidChangeConfiguration: jest.fn()
    }
}));

describe('EditorConfigService', () => {
    let service: EditorConfigService;
    let sendUpdateSpy: jest.Mock;
    let mockConfig: any;

    beforeEach(() => {
        sendUpdateSpy = jest.fn();
        service = new EditorConfigService(sendUpdateSpy);

        mockConfig = {
            get: jest.fn((key: string, defaultValue: any) => {
                const values: { [key: string]: any } = {
                    fontSize: 14,
                    fontFamily: 'Consolas',
                    lineHeight: 0
                };
                return values[key] ?? defaultValue;
            })
        };

        (vscode.workspace.getConfiguration as jest.Mock).mockReturnValue(mockConfig);
    });

    describe('config watching', () => {
        it('should send initial config when starting', () => {
            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            expect(sendUpdateSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'updateConfig',
                    data: expect.objectContaining({
                        fontSize: 14,
                        fontFamily: 'Consolas',
                        lineHeight: expect.any(Number)
                    })
                })
            );
        });

        it('should watch for config changes', () => {
            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            expect(vscode.workspace.onDidChangeConfiguration).toHaveBeenCalled();
        });

        it('should send update when fontSize changes', () => {
            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            const changeHandler = (vscode.workspace.onDidChangeConfiguration as jest.Mock).mock.calls[0][0];
            changeHandler({
                affectsConfiguration: (key: string) => key === 'editor.fontSize'
            });

            expect(sendUpdateSpy).toHaveBeenCalledTimes(2); // Initial + change
        });

        it('should send update when fontFamily changes', () => {
            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            const changeHandler = (vscode.workspace.onDidChangeConfiguration as jest.Mock).mock.calls[0][0];
            changeHandler({
                affectsConfiguration: (key: string) => key === 'editor.fontFamily'
            });

            expect(sendUpdateSpy).toHaveBeenCalledTimes(2);
        });

        it('should send update when lineHeight changes', () => {
            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            const changeHandler = (vscode.workspace.onDidChangeConfiguration as jest.Mock).mock.calls[0][0];
            changeHandler({
                affectsConfiguration: (key: string) => key === 'editor.lineHeight'
            });

            expect(sendUpdateSpy).toHaveBeenCalledTimes(2);
        });

        it('should not send update for unrelated config changes', () => {
            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            const changeHandler = (vscode.workspace.onDidChangeConfiguration as jest.Mock).mock.calls[0][0];
            changeHandler({
                affectsConfiguration: (key: string) => key === 'editor.tabSize'
            });

            expect(sendUpdateSpy).toHaveBeenCalledTimes(1); // Only initial
        });
    });

    describe('config calculation', () => {
        it('should calculate lineHeight from fontSize when lineHeight is 0', () => {
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'fontSize') return 16;
                if (key === 'lineHeight') return 0;
                return 'Consolas';
            });

            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            const call = sendUpdateSpy.mock.calls[0][0];
            expect(call.data.lineHeight).toBe(24); // 16 * 1.5
        });

        it('should use configured lineHeight when not 0', () => {
            mockConfig.get.mockImplementation((key: string) => {
                if (key === 'fontSize') return 14;
                if (key === 'lineHeight') return 20;
                return 'Consolas';
            });

            const mockContext = {
                subscriptions: []
            } as any;

            service.startWatching(mockContext);

            const call = sendUpdateSpy.mock.calls[0][0];
            expect(call.data.lineHeight).toBe(20);
        });
    });
});
