/**
 * Message Router Pattern
 * 
 * Decouples message protocol from business logic by using a registry pattern.
 * This allows:
 * - Easy testing of message handling
 * - Middleware support (logging, validation, error handling)
 * - Type-safe message routing
 * - Extensibility without modifying core files
 */

import { ExtensionMessage, ExtensionMessageType, ExtensionMessageData } from '../shared/messages';

type MessageHandler<T extends ExtensionMessageType> = (data: ExtensionMessageData<T>) => void | Promise<void>;
type Middleware = (message: ExtensionMessage) => ExtensionMessage | null | Promise<ExtensionMessage | null>;

export class MessageRouter {
    private handlers = new Map<ExtensionMessageType, (data: unknown) => void | Promise<void>>();
    private middleware: Middleware[] = [];

    /**
     * Register a handler for a specific message type
     */
    register<T extends ExtensionMessageType>(
        type: T,
        handler: MessageHandler<T>
    ): void {
        this.handlers.set(type, handler as (data: unknown) => void | Promise<void>);
    }

    /**
     * Add middleware (runs before handlers)
     * Middleware can:
     * - Transform messages
     * - Block messages (return null)
     * - Log messages
     * - Validate messages
     */
    use(middleware: Middleware): void {
        this.middleware.push(middleware);
    }

    /**
     * Handle a message
     * Runs middleware first, then calls the registered handler
     */
    async handle(message: ExtensionMessage): Promise<void> {
        // Run middleware in order
        let processedMessage = message;
        for (const mw of this.middleware) {
            const result = await mw(processedMessage);
            if (result === null) {
                // Middleware blocked the message
                return;
            }
            processedMessage = result;
        }

        // Find and call handler
        const handler = this.handlers.get(processedMessage.type);
        if (!handler) {
            console.warn(`[MessageRouter] No handler registered for message type: ${processedMessage.type}`);
            return;
        }

        try {
            // Extract data if present, otherwise pass undefined
            // Type safety is ensured at registration time via the register() method
            const data = 'data' in processedMessage ? (processedMessage as { data: unknown }).data : undefined;
            await (handler as (data: unknown) => void | Promise<void>)(data);
        } catch (error) {
            console.error(`[MessageRouter] Error handling message type "${processedMessage.type}":`, error);
            throw error;
        }
    }

    /**
     * Check if a handler is registered for a message type
     */
    hasHandler(type: ExtensionMessageType): boolean {
        return this.handlers.has(type);
    }
}
