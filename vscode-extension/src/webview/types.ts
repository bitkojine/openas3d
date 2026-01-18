import * as THREE from 'three';

/**
 * A visualized code entity in the 3D world
 */
export interface CodeObject {
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

/**
 * A visual dependency edge between two CodeObjects
 */
export interface DependencyEdge {
    id: string;
    source: string; // CodeObject.id
    target: string; // CodeObject.id
    type: 'import' | 'extends' | 'calls';

    /**
     * Three.js line rendered in the scene
     */
    line: THREE.Line;
}
