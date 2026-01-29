import { MessageRouter, Logger } from '../message-router';
import { ExtensionMessage } from '../../shared/messages';

class FakeLogger implements Logger {
    public warnings: string[] = [];
    public errors: { msg: string, error: any }[] = [];

    warn(message: string) {
        this.warnings.push(message);
    }
    error(message: string, error: any) {
        this.errors.push({ msg: message, error });
    }
}

describe('MessageRouter (Behavioral)', () => {
    let router: MessageRouter;
    let fakeLogger: FakeLogger;

    beforeEach(() => {
        fakeLogger = new FakeLogger();
        router = new MessageRouter(fakeLogger);
    });

    describe('handler registration and execution', () => {
        it('should call registered handler when message is handled', async () => {
            let called = false;
            router.register('clear', () => { called = true; });

            await router.handle({ type: 'clear' });

            expect(called).toBe(true);
        });

        it('should pass data to handler', async () => {
            let receivedData: any = null;
            router.register('addObject', (data) => { receivedData = data; });

            const testData = {
                id: 'test',
                type: 'file' as const,
                filePath: '/test.ts',
                position: { x: 0, y: 0, z: 0 }
            };

            await router.handle({ type: 'addObject', data: testData });

            expect(receivedData).toEqual(testData);
        });
    });

    describe('middleware', () => {
        it('should allow middleware to transform messages', async () => {
            let receivedData: any = null;

            router.use((msg) => {
                if (msg.type === 'addObject' && 'data' in msg) {
                    return {
                        ...msg,
                        data: {
                            ...msg.data,
                            id: 'transformed-' + msg.data.id
                        }
                    };
                }
                return msg;
            });

            router.register('addObject', (data) => { receivedData = data; });

            await router.handle({
                type: 'addObject',
                data: {
                    id: 'original',
                    type: 'file',
                    filePath: '/test.ts',
                    position: { x: 0, y: 0, z: 0 }
                }
            });

            expect(receivedData.id).toBe('transformed-original');
        });

        it('should allow middleware to block messages', async () => {
            let handlerCalled = false;
            router.use((msg) => null);

            router.register('clear', () => { handlerCalled = true; });
            await router.handle({ type: 'clear' });

            expect(handlerCalled).toBe(false);
        });
    });

    describe('error handling', () => {
        it('should log warning for unregistered message types', async () => {
            await router.handle({ type: 'clear' });

            expect(fakeLogger.warnings[0]).toContain('No handler registered for message type: clear');
        });

        it('should log errors from handlers', async () => {
            const testError = new Error('Test error');
            router.register('clear', () => { throw testError; });

            try {
                await router.handle({ type: 'clear' });
            } catch (e) {
                // Expected
            }

            expect(fakeLogger.errors[0].msg).toContain('Error handling message type "clear":');
            expect(fakeLogger.errors[0].error).toBe(testError);
        });
    });

    describe('hasHandler', () => {
        it('should return true for registered handlers', () => {
            router.register('clear', () => { });
            expect(router.hasHandler('clear')).toBe(true);
        });

        it('should return false for unregistered handlers', () => {
            expect(router.hasHandler('clear')).toBe(false);
        });
    });
});
