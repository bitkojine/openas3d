/**
 * Pure Code Entity types - no Three.js dependencies.
 * These are serializable and can be used anywhere.
 */

/**
 * Entity type for visual representation
 */
export type CodeEntityType = 'file' | 'module' | 'class' | 'function' | 'sign';

/**
 * Position in 3D space (pure data, no THREE dependency)
 */
export interface Position3D {
    x: number;
    y: number;
    z: number;
}

/**
 * A code entity in the domain model (pure, serializable).
 * This is the "document" representation before it becomes a 3D object.
 */
export interface CodeEntity {
    id: string;
    type: CodeEntityType;
    filePath: string;
    position: Position3D;
    metadata: Record<string, unknown>;
    description: string;
    descriptionStatus?: 'missing' | 'generated' | 'reconciled';
    descriptionLastUpdated?: string;
}

/**
 * Import kind for visual distinction (shared between domain and rendering)
 */
export type ImportKind = 'value' | 'type' | 'reexport';

/**
 * A dependency relationship (pure, serializable)
 */
export interface Dependency {
    id: string;
    source: string; // CodeEntity.id
    target: string; // CodeEntity.id
    type: 'import' | 'extends' | 'calls';
    weight: number;
    isCircular: boolean;
    importKind: ImportKind;
}
