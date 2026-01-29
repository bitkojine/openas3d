throw new Error("Mock Sabotaged! This test uses mocking (jest.mock, jest.fn, or jest.spyOn).");

/**
 * Tests for MessageRouter
 * 
 * Verifies that the router correctly:
 * - Calls registered handlers
 * - Passes data to handlers
 * - Runs middleware before handlers
 * - Handles missing handlers gracefully
 */

import { MessageRouter } from '../message-router';
import { ExtensionMessage } from '../../shared/messages';

describe('MessageRouter', () => {
    let router: MessageRouter;

    beforeEach(() => {
        router = new MessageRouter();
    });

    describe('handler registration and execution', () => {
        it('should call registered handler when message is handled', async () => {
            let called = false;

            router.register('clear', () => {
                called = true;
            });

            await router.handle({ type: 'clear' });

            expect(called).toBe(true);
        });

        it('should pass data to handler', async () => {
            let receivedData: any = null;

            router.register('addObject', (data) => {
                receivedData = data;
            });

            const testData = {
                id: 'test',
                type: 'file' as const,
                filePath: '/test.ts',
                position: { x: 0, y: 0, z: 0 }
            };

            await router.handle({ type: 'addObject', data: testData });

            expect(receivedData).toEqual(testData);
        });

        it('should handle messages without data', async () => {
            let called = false;

            router.register('clear', () => {
                called = true;
            });

            await router.handle({ type: 'clear' });

            expect(called).toBe(true);
        });

        it('should handle async handlers', async () => {
            let resolved = false;

            router.register('clear', async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                resolved = true;
            });

            await router.handle({ type: 'clear' });

            expect(resolved).toBe(true);
        });
    });

    describe('middleware', () => {
        it('should run middleware before handler', async () => {
            const order: string[] = [];

            router.use((msg) => {
                order.push('middleware');
                return msg;
            });

            router.register('clear', () => {
                order.push('handler');
            });

            await router.handle({ type: 'clear' });

            expect(order).toEqual(['middleware', 'handler']);
        });

        it('should run multiple middleware in order', async () => {
            const order: string[] = [];

            router.use((msg) => {
                order.push('middleware1');
                return msg;
            });

            router.use((msg) => {
                order.push('middleware2');
                return msg;
            });

            router.register('clear', () => {
                order.push('handler');
            });

            await router.handle({ type: 'clear' });

            expect(order).toEqual(['middleware1', 'middleware2', 'handler']);
        });

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

            router.register('addObject', (data) => {
                receivedData = data;
            });

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

            router.use((msg) => {
                // Block all messages
                return null;
            });

            router.register('clear', () => {
                handlerCalled = true;
            });

            await router.handle({ type: 'clear' });

            expect(handlerCalled).toBe(false);
        });

        it('should handle async middleware', async () => {
            const order: string[] = [];

            router.use(async (msg) => {
                await new Promise(resolve => setTimeout(resolve, 10));
                order.push('async-middleware');
                return msg;
            });

            router.register('clear', () => {
                order.push('handler');
            });

            await router.handle({ type: 'clear' });

            expect(order).toEqual(['async-middleware', 'handler']);
        });
    });

    describe('error handling', () => {
        it('should log warning for unregistered message types', async () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

            await router.handle({ type: 'clear' });

            expect(consoleSpy).toHaveBeenCalledWith(
                '[MessageRouter] No handler registered for message type: clear'
            );

            consoleSpy.mockRestore();
        });

        it('should propagate errors from handlers', async () => {
            const testError = new Error('Test error');

            router.register('clear', () => {
                throw testError;
            });

            await expect(router.handle({ type: 'clear' })).rejects.toThrow('Test error');
        });

        it('should log errors from handlers', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const testError = new Error('Test error');

            router.register('clear', () => {
                throw testError;
            });

            try {
                await router.handle({ type: 'clear' });
            } catch (e) {
                // Expected
            }

            expect(consoleSpy).toHaveBeenCalledWith(
                '[MessageRouter] Error handling message type "clear":',
                testError
            );

            consoleSpy.mockRestore();
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

    describe('multiple handlers', () => {
        it('should allow registering multiple different message types', async () => {
            const calls: string[] = [];

            router.register('clear', () => {
                calls.push('clear');
            });

            router.register('addObject', () => {
                calls.push('addObject');
            });

            await router.handle({ type: 'clear' });
            await router.handle({
                type: 'addObject',
                data: {
                    id: 'test',
                    type: 'file',
                    filePath: '/test.ts',
                    position: { x: 0, y: 0, z: 0 }
                }
            });

            expect(calls).toEqual(['clear', 'addObject']);
        });
    });
});
