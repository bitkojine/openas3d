import * as THREE from 'three';
import { CodeEntity, Dependency, ImportKind, Position3D, CodeEntityType } from '../core/domain';

// Re-export pure types for convenience
export { ImportKind, Position3D, CodeEntityType };

/**
 * A renderable code entity in the 3D world.
 * Extends the pure CodeEntity with Three.js rendering concerns.
 * Renamed from CodeEntityDTO to RenderableEntity to avoid confusion with pure DTOs.
 */
export interface RenderableEntity extends Omit<CodeEntity, 'position'> {
    /**
     * World-space position (THREE.Vector3 for rendering)
     */
    position: THREE.Vector3;

    /**
     * Three.js mesh representing this object (optional if instanced)
     */
    mesh?: THREE.Mesh;

    /**
     * Three.js sprite for the floating description label
     */
    descriptionMesh?: THREE.Sprite;
}

/**
 * A renderable dependency edge between two CodeObjects.
 * Extends the pure Dependency with Three.js rendering concerns.
 */
export interface DependencyDTO extends Dependency {
    /**
     * Three.js group containing the curve line and arrow
     */
    line: THREE.Group;
}

