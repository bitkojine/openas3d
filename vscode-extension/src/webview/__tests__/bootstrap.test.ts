/**
 * Tests for bootstrap.ts origin verification
 * 
 * Verifies that the bootstrap message handler correctly:
 * - Accepts messages from trusted VSCode webview origins
 * - Rejects messages from untrusted origins
 * - Logs warnings when rejecting untrusted messages
 */

import { ExtensionMessage } from '../../shared/messages';

// Mock DOM environment
const mockAddEventListener = jest.fn();
const mockConsoleWarn = jest.fn();
const mockConsoleError = jest.fn();

// Mock window object
Object.defineProperty(global, 'window', {
    value: {
        addEventListener: mockAddEventListener,
        location: { origin: 'vscode-webview://test' }
    },
    writable: true
});

// Mock console
Object.defineProperty(global, 'console', {
    value: {
        warn: mockConsoleWarn,
        error: mockConsoleError,
        log: jest.fn()
    },
    writable: true
});

// Mock acquireVsCodeApi
const mockVscode = {
    postMessage: jest.fn()
};

Object.defineProperty(global, 'acquireVsCodeApi', {
    value: () => mockVscode,
    writable: true
});

// Mock World and MessageRouter
const mockWorld = {
    registerMessageHandlers: jest.fn()
};

const mockRouter = {
    handle: jest.fn(),
    use: jest.fn()
};

// Mock the modules
jest.mock('../world', () => ({
    World: jest.fn().mockImplementation(() => mockWorld)
}));

jest.mock('../message-router', () => ({
    MessageRouter: jest.fn().mockImplementation(() => mockRouter)
}));

describe('Bootstrap Origin Verification', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset modules to ensure fresh import
        jest.resetModules();
        
        // Clear any existing event listeners
        mockAddEventListener.mockClear();
    });

    describe('message event listener', () => {
        it('should register message event listener on bootstrap', async () => {
            // Import bootstrap to trigger initialization
            await import('../bootstrap');
            
            expect(mockAddEventListener).toHaveBeenCalledWith('message', expect.any(Function));
        });

        it('should accept messages from trusted vscode-webview origins', async () => {
            await import('../bootstrap');
            
            // Get the message handler function
            const messageHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];
            
            expect(messageHandler).toBeDefined();
            
            // Simulate DOMContentLoaded to initialize world and router
            const domContentLoadedHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'DOMContentLoaded'
            )?.[1];
            
            if (domContentLoadedHandler) {
                await domContentLoadedHandler();
            }
            
            // Create a trusted message event
            const trustedEvent = {
                origin: 'vscode-webview://vscode-resource',
                data: { type: 'loadWorld' as const }
            };
            
            await messageHandler(trustedEvent);
            
            // Should not log warning for trusted origin
            expect(mockConsoleWarn).not.toHaveBeenCalled();
            
            // Should attempt to handle the message
            expect(mockRouter.handle).toHaveBeenCalledWith({ type: 'loadWorld' });
        });

        it('should accept messages from any vscode-webview subdomain', async () => {
            await import('../bootstrap');
            
            const messageHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];
            
            // Simulate DOMContentLoaded
            const domContentLoadedHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'DOMContentLoaded'
            )?.[1];
            
            if (domContentLoadedHandler) {
                await domContentLoadedHandler();
            }
            
            // Test various vscode-webview origins
            const trustedOrigins = [
                'vscode-webview://vscode-resource',
                'vscode-webview://abc123-def456',
                'vscode-webview://test-environment'
            ];
            
            for (const origin of trustedOrigins) {
                const trustedEvent = {
                    origin,
                    data: { type: 'clear' as const }
                };
                
                await messageHandler(trustedEvent);
                
                expect(mockConsoleWarn).not.toHaveBeenCalled();
            }
        });

        it('should reject messages from untrusted origins', async () => {
            await import('../bootstrap');
            
            const messageHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];
            
            // Simulate DOMContentLoaded
            const domContentLoadedHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'DOMContentLoaded'
            )?.[1];
            
            if (domContentLoadedHandler) {
                await domContentLoadedHandler();
            }
            
            // Create an untrusted message event
            const untrustedEvent = {
                origin: 'https://malicious-site.com',
                data: { type: 'clear' as const }
            };
            
            await messageHandler(untrustedEvent);

            // Should not attempt to handle the message
            expect(mockRouter.handle).not.toHaveBeenCalled();
        });

        it('should reject messages from various untrusted origins', async () => {
            await import('../bootstrap');
            
            const messageHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];
            
            // Simulate DOMContentLoaded
            const domContentLoadedHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'DOMContentLoaded'
            )?.[1];
            
            if (domContentLoadedHandler) {
                await domContentLoadedHandler();
            }
            
            // Test various untrusted origins
            const untrustedOrigins = [
                'https://evil.com',
                'http://localhost:3000',
                'file://',
                'null',
                '',
                'vscode-webview-evil://fake'
            ];
            
            for (const origin of untrustedOrigins) {
                const untrustedEvent = {
                    origin,
                    data: { type: 'clear' as const }
                };
                
                await messageHandler(untrustedEvent);
            }
            
            // Should never attempt to handle any untrusted messages
            expect(mockRouter.handle).not.toHaveBeenCalled();
        });

        it('should not process messages when world or router not initialized', async () => {
            await import('../bootstrap');
            
            const messageHandler = mockAddEventListener.mock.calls.find(
                call => call[0] === 'message'
            )?.[1];
            
            // Don't trigger DOMContentLoaded, so world and router remain undefined
            
            const trustedEvent = {
                origin: 'vscode-webview://vscode-resource',
                data: { type: 'clear' as const }
            };
            
            await messageHandler(trustedEvent);
            
            // Should log error about uninitialized world/router
            expect(mockConsoleError).toHaveBeenCalledWith(
                '[Bootstrap] World or router not initialized, dropping message:',
                'clear'
            );
            
            // Should not attempt to handle the message
            expect(mockRouter.handle).not.toHaveBeenCalled();
        });
    });
});
