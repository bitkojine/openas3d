import * as THREE from 'three';

/**
 * A visualized code entity in the 3D world
 */
/**
 * A visualized code entity in the 3D world
 */
export interface CodeEntityDTO {
    id: string;
    type: 'file' | 'module' | 'class' | 'function' | 'sign'; // ✅ added 'sign'
    filePath: string;

    /**
     * World-space position (kept separately from mesh for logic)
     */
    position: THREE.Vector3;

    /**
     * Three.js mesh representing this object
     */
    mesh: THREE.Mesh;

    /**
     * Arbitrary metadata provided by the extension
     * (symbol info, language data, etc.)
     */
    metadata: any;

    /**
     * Short summary used in floating labels
     */
    description: string;

    /**
     * Three.js sprite for the floating description label
     */
    descriptionMesh?: THREE.Sprite;

    /**
     * Status of the description: 'missing' | 'generated' | 'reconciled'
     */
    descriptionStatus?: string;

    /**
     * ISO string of last update time for the description
     */
    descriptionLastUpdated?: string;
}

/** Import kind for visual distinction */
export type ImportKind = 'value' | 'type' | 'reexport';

/**
 * A visual dependency edge between two CodeObjects
 */
export interface DependencyDTO {
    id: string;
    source: string; // CodeObject.id
    target: string; // CodeObject.id
    type: 'import' | 'extends' | 'calls';
    /** Number of imports from source to target (for line thickness) */
    weight: number;
    /** True if this is part of a circular dependency */
    isCircular: boolean;
    /** Kind of import for visual styling */
    importKind: ImportKind;

    /**
     * Three.js group containing the curve line and arrow
     */
    line: THREE.Group;
}
