/**
 * Abstract base class for all 3D objects in the scene.
 * Enforces a common contract for creation, updates, and lifecycle management.
 * Implements CodeObject interface for compatibility with existing systems.
 */
import * as THREE from 'three';
import { CodeEntityDTO } from '../types';

export abstract class VisualObject implements CodeEntityDTO {
    public mesh: THREE.Mesh;
    public id: string;
    public type: 'file' | 'module' | 'class' | 'function' | 'sign';
    public position: THREE.Vector3;
    public metadata: any;

    // CodeObject compatibility
    public filePath: string;
    public description: string = 'No description';
    public descriptionStatus?: 'missing' | 'generated' | 'reconciled';
    public descriptionLastUpdated?: string;
    public descriptionMesh?: THREE.Sprite;

    /**
     * Initialize label for this object.
     * Optional implementation for objects that support labels.
     */
    public initializeLabel?(scene: THREE.Scene): void;

    constructor(id: string, type: string, position: THREE.Vector3, metadata: any = {}) {
        this.id = id;
        this.type = type as any;
        this.position = position;
        this.metadata = metadata;
        this.filePath = metadata.filePath || '';
        this.description = metadata.description || 'No description';

        // Initialize description state from metadata if present
        if (metadata.descriptionStatus) { this.descriptionStatus = metadata.descriptionStatus; }
        if (metadata.descriptionLastUpdated) { this.descriptionLastUpdated = metadata.descriptionLastUpdated; }

        this.mesh = this.createMesh(); // Template method
        this.mesh.position.copy(position);

        // Link back to this object for raycasting/interaction identification
        this.mesh.userData.visualObject = this;
    }

    /**
     * Create the THREE.Mesh for this object.
     * Must be implemented by subclasses.
     */
    protected abstract createMesh(): THREE.Mesh;

    /**
     * Update the object with new data (e.g. from file change)
     */
    public abstract update(data: any): void;

    /**
     * Called when this object is selected
     */
    public select(): void {
        this.setEmissive(0x444444);
    }

    /**
     * Called when this object is deselected
     */
    public deselect(): void {
        this.setEmissive(0x000000);
    }

    /**
     * Called when this object is focused (hover/related)
     */
    public setInteractionState(start: boolean): void {
        this.setEmissive(start ? 0xaaaaaa : 0x000000);
    }

    public getHeight(): number {
        this.mesh.geometry.computeBoundingBox();
        return this.mesh.geometry.boundingBox
            ? this.mesh.geometry.boundingBox.max.y - this.mesh.geometry.boundingBox.min.y
            : 1;
    }

    /**
     * Clean up resources (geometries, materials)
     */
    public dispose(): void {
        if (this.mesh.geometry) { this.mesh.geometry.dispose(); }

        const materials = Array.isArray(this.mesh.material)
            ? this.mesh.material
            : [this.mesh.material];

        materials.forEach(m => {
            m.dispose();
        });
    }

    protected setEmissive(colorHex: number): void {
        const materials = Array.isArray(this.mesh.material) ? this.mesh.material : [this.mesh.material];
        materials.forEach(mat => {
            if ((mat as THREE.MeshLambertMaterial).emissive) {
                (mat as THREE.MeshLambertMaterial).emissive.setHex(colorHex);
            }
        });
    }

    /**
     * Set highlight state (alias for setInteractionState for now, or specific)
     */
    public setHighlight(active: boolean): void {
        this.setEmissive(active ? 0xaaaaaa : 0x000000);
    }

    /**
     * Convert to the CodeObject interface expected by legacy systems/DependencyManager
     * TODO: Eventually migrate DependencyManager to use VisualObject directly
     */
    public toCodeObject(): CodeEntityDTO {
        return this;
    }

    public toCodeEntityDTO(): CodeEntityDTO {
        return this;
    }
}
