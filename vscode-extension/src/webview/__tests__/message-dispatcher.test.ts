import { MessageDispatcher, WebviewMessenger } from '../message-dispatcher';
import { ExtensionMessage } from '../../shared/messages';

class FakeWebview implements WebviewMessenger {
    public sent: any[] = [];
    postMessage(message: any): Thenable<boolean> {
        this.sent.push(message);
        return Promise.resolve(true);
    }
}

describe('MessageDispatcher (Behavioral)', () => {
    let dispatcher: MessageDispatcher;
    let fakeWebview: FakeWebview;

    beforeEach(() => {
        fakeWebview = new FakeWebview();
        dispatcher = new MessageDispatcher(() => fakeWebview);
    });

    describe('message sending', () => {
        it('should send message to webview', () => {
            const message: ExtensionMessage = { type: 'clear' };
            dispatcher.sendMessage(message);

            expect(fakeWebview.sent[0]).toEqual(message);
        });

        it('should handle undefined webview gracefully', () => {
            const nullDispatcher = new MessageDispatcher(() => undefined);
            expect(() => nullDispatcher.sendMessage({ type: 'clear' })).not.toThrow();
        });
    });

    describe('message waiting', () => {
        it('should resolve waiter when message is received', async () => {
            const promise = dispatcher.waitForMessage('ready');
            const data = { foo: 'bar' };

            dispatcher.notifyMessageReceived('ready', data);

            const result = await promise;
            expect(result).toBe(data);
        });

        it('should remove waiter after resolving', async () => {
            const promise = dispatcher.waitForMessage('ready');
            dispatcher.notifyMessageReceived('ready');
            await promise;

            // This next waiter should stay pending
            let resolved = false;
            dispatcher.waitForMessage('ready').then(() => { resolved = true; });

            await new Promise(r => setTimeout(r, 10));
            expect(resolved).toBe(false);
        });
    });

    describe('ready state management', () => {
        it('should set ready state when ready message arrives', () => {
            expect(dispatcher.getReady()).toBe(false);
            dispatcher.notifyMessageReceived('ready');
            expect(dispatcher.getReady()).toBe(true);
        });

        it('should provide a promise that waits for ready', async () => {
            let ready = false;
            dispatcher.ensureReady().then(() => { ready = true; });

            expect(ready).toBe(false);
            dispatcher.notifyMessageReceived('ready');

            await new Promise(r => setTimeout(r, 0));
            expect(ready).toBe(true);
        });
    });
});
