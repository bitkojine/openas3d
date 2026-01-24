/**
 * Type-Safe Messaging Protocol
 * 
 * This module defines the typed message protocol for Extension <-> Webview communication.
 * Both sides of the communication channel use these types to ensure type safety.
 * 
 * Naming Convention:
 * - ExtensionMessage: Messages sent FROM the Extension Host TO the Webview
 * - WebviewMessage: Messages sent FROM the Webview TO the Extension Host
 */

import { ZoneDTO, ArchitectureWarning, ImportKind, Position3D, EditorConfig, TestDTO } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Payload Types (shared data structures)
// ─────────────────────────────────────────────────────────────────────────────

/** 3D position for placement in the world */
export type Position3DPayload = Position3D;

/** Size dimensions for objects */
export interface SizePayload {
    width?: number;
    height?: number;
    depth?: number;
}

/** Payload for adding a new object to the scene */
export interface AddObjectPayload {
    id: string;
    type: 'file' | 'module' | 'class' | 'function' | 'sign';
    filePath: string;
    position: Position3DPayload;
    size?: SizePayload;
    color?: number;
    metadata?: unknown;
    description?: string;
    descriptionStatus?: 'missing' | 'generated' | 'reconciled';
    descriptionLastUpdated?: string;
}

/** Payload for adding a dependency line between two objects */
export interface AddDependencyPayload {
    id: string;
    source: string;  // Source object ID
    target: string;  // Target object ID
    type: 'import' | 'extends' | 'calls';
    weight?: number;
    isCircular?: boolean;
    importKind?: ImportKind;
}

/** Payload for updating object position */
export interface UpdatePositionPayload {
    id: string;
    position: Position3DPayload;
}

/** Payload for updating object description */
export interface UpdateDescriptionPayload {
    filePath: string;
    description: {
        summary: string;
        status: 'missing' | 'generated' | 'reconciled';
        lastUpdated?: string;
    };
}

/** Payload for object selection/focus events */
export interface ObjectEventPayload {
    id: string;
    type: string;
    filePath: string;
    metadata?: unknown;
    description?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Extension -> Webview Messages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Messages sent from the Extension Host to the Webview.
 * Uses a discriminated union pattern for type safety.
 */
export type ExtensionMessage =
    // World Management
    | { type: 'loadWorld' }
    | { type: 'clear' }

    // Object Management
    | { type: 'addObject'; data: AddObjectPayload }
    | { type: 'removeObject'; data: { id: string } }
    | { type: 'updateObjectPosition'; data: UpdatePositionPayload }
    | { type: 'updateObjectDescription'; data: UpdateDescriptionPayload }

    // Dependency Management
    | { type: 'addDependency'; data: AddDependencyPayload }
    | { type: 'removeDependency'; data: { id: string } }
    | { type: 'showDependencies' }
    | { type: 'hideDependencies' }
    | { type: 'dependenciesComplete' }

    // Zone Management
    | { type: 'setZoneBounds'; data: ZoneDTO[] }

    // Architecture Analysis
    | { type: 'setWarnings'; data: ArchitectureWarning[] }
    | { type: 'architectureError'; data: { message: string } }

    // Performance
    | { type: 'perfUpdate'; data: { stats: { label: string; count: number; avg: number; max: number }[] } }
    | { type: 'perfStats'; data: { label: string; count: number; avg: number; max: number }[] }

    // Configuration
    | { type: 'updateConfig'; data: EditorConfig }

    // Test Data
    | { type: 'updateTests'; data: TestDTO[] }

    // Test Messages (only active in test mode)
    | { type: 'TEST_GET_SCENE_STATE' }
    | { type: 'TEST_SIMULATE_SELECTION'; data: { id: string } }
    | { type: 'TEST_SIMULATE_MOVE'; data: { x: number; z: number } }
    | { type: 'TEST_SIMULATE_INPUT'; data: { kind: string; code?: string } }
    | { type: 'TEST_TELEPORT'; data: { x: number; y: number; z: number } }
    | { type: 'TEST_LOOK_AT'; data: { x: number; y: number; z: number; duration?: number } }
    | { type: 'TEST_GET_POSITION' };

// ─────────────────────────────────────────────────────────────────────────────
// Webview -> Extension Messages
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Messages sent from the Webview to the Extension Host.
 * Uses a discriminated union pattern for type safety.
 */
export type WebviewMessage =
    // Lifecycle
    | { type: 'ready' }

    // Logging
    | { type: 'log'; data: { message: string } }
    | { type: 'error'; data: { message: string } }

    // User Interaction
    | { type: 'objectSelected'; data: ObjectEventPayload }
    | { type: 'objectFocused'; data: ObjectEventPayload }
    | { type: 'openFile'; data: { filePath: string } }
    | { type: 'openFiles'; data: { codeFile: string } }
    | { type: 'navigateToFile'; data: { fileId: string } }
    | { type: 'moveObject'; data: { id: string; position: Position3DPayload } }
    | { type: 'runAllTests' }

    // Sign Management
    | { type: 'addSignAtPosition'; data: { position: Position3DPayload } }

    // Test Message Responses
    | { type: 'TEST_SCENE_STATE'; data: unknown }
    | { type: 'TEST_SELECTION_DONE' }
    | { type: 'TEST_MOVE_DONE' }
    | { type: 'TEST_INPUT_DONE' }
    | { type: 'TEST_TELEPORT_DONE' }
    | { type: 'TEST_LOOK_AT_DONE' }
    | { type: 'TEST_POSITION'; data: Position3DPayload };

// ─────────────────────────────────────────────────────────────────────────────
// Type Guards and Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Type guard to check if a message is an Extension message.
 */
export function isExtensionMessage(message: unknown): message is ExtensionMessage {
    return typeof message === 'object' && message !== null && 'type' in message;
}

/**
 * Type guard to check if a message is a Webview message.
 */
export function isWebviewMessage(message: unknown): message is WebviewMessage {
    return typeof message === 'object' && message !== null && 'type' in message;
}

/**
 * Helper type to extract the message type string literal.
 */
export type ExtensionMessageType = ExtensionMessage['type'];
export type WebviewMessageType = WebviewMessage['type'];

/**
 * Helper type to extract the data type for a specific message type.
 */
export type ExtensionMessageData<T extends ExtensionMessageType> =
    Extract<ExtensionMessage, { type: T }> extends { data: infer D } ? D : never;

export type WebviewMessageData<T extends WebviewMessageType> =
    Extract<WebviewMessage, { type: T }> extends { data: infer D } ? D : never;
