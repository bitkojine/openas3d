import { WebviewMessageHandler, UIProxy } from '../webview-message-handler';
import { WebviewMessage } from '../../shared/messages';

class FakeDispatcher {
    public received: { type: string, data?: any }[] = [];
    notifyMessageReceived(type: string, data?: any) {
        this.received.push({ type, data });
    }
}

class FakeUI implements UIProxy {
    public errors: string[] = [];
    async showErrorMessage(message: string) {
        this.errors.push(message);
    }
}

describe('WebviewMessageHandler (Behavioral)', () => {
    let handler: WebviewMessageHandler;
    let fakeDispatcher: FakeDispatcher;
    let fakeUI: FakeUI;

    beforeEach(() => {
        fakeDispatcher = new FakeDispatcher();
        fakeUI = new FakeUI();
        handler = new WebviewMessageHandler(fakeDispatcher, fakeUI);
    });

    describe('message routing', () => {
        it('should call registered handler and notify dispatcher', async () => {
            let receivedData: any = null;
            handler.register('objectSelected', (data) => {
                receivedData = data;
            });

            const data = { id: 'test-id', type: 'file', filePath: '/test.ts' };
            const message: WebviewMessage = {
                type: 'objectSelected',
                data
            };

            await handler.handle(message);

            expect(receivedData).toEqual(data);
            expect(fakeDispatcher.received[0]).toEqual({ type: 'objectSelected', data });
        });

        it('should handle messages without data', async () => {
            let called = false;
            handler.register('ready', () => {
                called = true;
            });

            await handler.handle({ type: 'ready' });

            expect(called).toBe(true);
            expect(fakeDispatcher.received[0]).toEqual({ type: 'ready', data: undefined });
        });
    });

    describe('test messages', () => {
        it('should notify dispatcher but skip handler for test messages', async () => {
            let handlerCalled = false;
            handler.register('TEST_SELECTION_DONE' as any, () => {
                handlerCalled = true;
            });

            await handler.handle({ type: 'TEST_SELECTION_DONE' } as any);

            expect(fakeDispatcher.received[0].type).toBe('TEST_SELECTION_DONE');
            expect(handlerCalled).toBe(false);
        });
    });

    describe('error handling', () => {
        it('should catch and report handler errors via UI proxy', async () => {
            handler.register('ready', () => {
                throw new Error('Boom');
            });

            await handler.handle({ type: 'ready' });

            expect(fakeUI.errors[0]).toContain('Error handling webview message: Boom');
        });

        it('should handle non-Error exceptions', async () => {
            handler.register('ready', () => {
                throw 'Surprise';
            });

            await handler.handle({ type: 'ready' });

            expect(fakeUI.errors[0]).toContain('Error handling webview message: Surprise');
        });
    });

    describe('middleware', () => {
        it('should execute multiple middleware in onion order', async () => {
            const trace: string[] = [];

            handler.use(async (msg, next) => {
                trace.push('m1-in');
                await next();
                trace.push('m1-out');
            });

            handler.use(async (msg, next) => {
                trace.push('m2-in');
                await next();
                trace.push('m2-out');
            });

            handler.register('ready', () => {
                trace.push('handler');
            });

            await handler.handle({ type: 'ready' });

            expect(trace).toEqual(['m1-in', 'm2-in', 'handler', 'm2-out', 'm1-out']);
        });
    });

    describe('default handlers', () => {
        it('should show error message for the "error" message type', async () => {
            await handler.handle({
                type: 'error',
                data: { message: 'Something went wrong' }
            });

            expect(fakeUI.errors[0]).toBe('3D World Error: Something went wrong');
        });
    });
});
