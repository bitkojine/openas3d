import { EditorConfigService, WorkspaceProxy } from '../editor-config-service';
import { ExtensionMessage } from '../../shared/messages';
import * as vscode from 'vscode';

class FakeWorkspace implements WorkspaceProxy {
    private handlers: ((e: vscode.ConfigurationChangeEvent) => any)[] = [];
    public config: Record<string, any> = {
        'editor.fontSize': 14,
        'editor.fontFamily': 'Consolas',
        'editor.lineHeight': 0
    };

    getConfiguration(section: string) {
        return {
            get: <T>(key: string, defaultValue?: T): T | undefined => {
                return this.config[`${section}.${key}`] ?? defaultValue;
            }
        };
    }

    onDidChangeConfiguration = (handler: (e: vscode.ConfigurationChangeEvent) => any) => {
        this.handlers.push(handler);
        return { dispose: () => { } };
    };

    triggerChange(keys: string[]) {
        const event: vscode.ConfigurationChangeEvent = {
            affectsConfiguration: (section: string) => keys.includes(section)
        };
        this.handlers.forEach(h => h(event));
    }
}

describe('EditorConfigService (Behavioral)', () => {
    let service: EditorConfigService;
    let fakeWorkspace: FakeWorkspace;
    let sentMessages: ExtensionMessage[] = [];

    beforeEach(() => {
        sentMessages = [];
        fakeWorkspace = new FakeWorkspace();
        service = new EditorConfigService(
            (msg) => sentMessages.push(msg),
            fakeWorkspace
        );
    });

    it('should send initial config when starting', () => {
        const mockContext = { subscriptions: [] } as any;
        service.startWatching(mockContext);

        expect(sentMessages.length).toBe(1);
        expect(sentMessages[0]).toEqual({
            type: 'updateConfig',
            data: {
                fontSize: 14,
                fontFamily: 'Consolas',
                lineHeight: 21 // 14 * 1.5
            }
        });
    });

    it('should send update when fontSize changes', () => {
        const mockContext = { subscriptions: [] } as any;
        service.startWatching(mockContext);

        fakeWorkspace.config['editor.fontSize'] = 16;
        fakeWorkspace.triggerChange(['editor.fontSize']);

        expect(sentMessages.length).toBe(2);
        const lastMsg = sentMessages[1];
        if (lastMsg.type === 'updateConfig') {
            expect(lastMsg.data.fontSize).toBe(16);
            expect(lastMsg.data.lineHeight).toBe(24);
        } else {
            fail('Expected updateConfig message');
        }
    });

    it('should use configured lineHeight when not 0', () => {
        const mockContext = { subscriptions: [] } as any;
        fakeWorkspace.config['editor.lineHeight'] = 30;
        service.startWatching(mockContext);

        const lastMsg = sentMessages[0];
        if (lastMsg.type === 'updateConfig') {
            expect(lastMsg.data.lineHeight).toBe(30);
        } else {
            fail('Expected updateConfig message');
        }
    });

    it('should not send update for unrelated config changes', () => {
        const mockContext = { subscriptions: [] } as any;
        service.startWatching(mockContext);

        fakeWorkspace.triggerChange(['editor.tabSize']);

        expect(sentMessages.length).toBe(1); // Only initial
    });
});
