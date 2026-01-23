/**
 * Shared Type Definitions
 * 
 * These types are used across multiple layers (Core, Visualizers, Webview, Shared)
 * and must be in the shared layer to avoid dependency violations.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Zone Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * specialized DTO for serialization if needed, similar to old ZoneBounds
 */
export interface ZoneDTO {
    name: string;
    displayName: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    fileCount: number;
    color: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Analysis Types
// ─────────────────────────────────────────────────────────────────────────────

export type WarningSeverity = 'high' | 'medium' | 'low';
export type WarningType = 'layer-violation' | 'circular-dependency' | 'entry-bloat' | 'orphan' | 'unknown';

export interface ArchitectureWarning {
    fileId: string;
    type: WarningType;
    message: string;
    severity: WarningSeverity;
    ruleName?: string;
    cyclePath?: string[]; // List of file IDs in the cycle
    targetId?: string;    // Target file ID for edge violations
    relatedFileIds?: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Code Entity Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Import kind for visual distinction (shared between domain and rendering)
 */
export type ImportKind = 'value' | 'type' | 'reexport';

export interface Position3D {
    x: number;
    y: number;
    z: number;
}
