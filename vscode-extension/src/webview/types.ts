import * as THREE from 'three';

/**
 * A visualized code entity in the 3D world
 */
export interface CodeObject {
    id: string;
    type: 'file' | 'module' | 'class' | 'function';
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
