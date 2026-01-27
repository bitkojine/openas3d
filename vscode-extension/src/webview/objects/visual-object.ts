/**
 * Abstract base class for all 3D objects in the scene.
 * Enforces a common contract for creation, updates, and lifecycle management.
 * Implements RenderableEntity interface for compatibility with existing systems.
 */
import * as THREE from 'three';
import { RenderableEntity } from '../types';
import { ThemeColors, CodeEntityDTO } from '../../shared/types';

export abstract class VisualObject implements RenderableEntity {
    public mesh?: THREE.Mesh;
    public id: string;
    public type: 'file' | 'module' | 'class' | 'function' | 'sign';
    public position: THREE.Vector3;
    public metadata: any;
    public isPromoted = false;

    // CodeObject compatibility
    public filePath: string;
    public description: string = 'No description';
    public descriptionStatus?: 'missing' | 'generated' | 'reconciled';
    public descriptionLastUpdated?: string;
    public descriptionMesh?: THREE.Sprite;
    protected _cachedHeight?: number;

    constructor(id: string, type: string, position: THREE.Vector3, metadata: any = {}) {
        this.id = id;
        this.type = type as any;
        this.position = position.clone();
        this.metadata = metadata;
        this.filePath = metadata.filePath || '';
        this.description = metadata.description || 'No description';

        // Initialize description state from metadata if present
        if (metadata.descriptionStatus) { this.descriptionStatus = metadata.descriptionStatus; }
        if (metadata.descriptionLastUpdated) { this.descriptionLastUpdated = metadata.descriptionLastUpdated; }
    }

    /** Promotes the object to high-detail mode (creates mesh) */
    public abstract promote(scene: THREE.Scene): void;

    /** Demotes the object to instanced mode (disposes mesh) */
    public abstract demote(scene: THREE.Scene): void;

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
     * Update the object appearance based on the theme
     */
    public abstract updateTheme(theme: ThemeColors): void;

    /**
     * Animate the object (called per frame)
     */
    public animate(time: number, deltaTime: number): void {
        if (!this.mesh) return;

        // Default rotation for all code objects
        const rotationSpeed = 0.5; // radians per second
        this.mesh.rotation.y += rotationSpeed * deltaTime;
    }


    /**
     * Update label position (called every frame if needed, e.g. for billboarding)
     */
    public updateLabelPosition(camera: THREE.Camera): void {
        const meshHeight = this.getHeight();
        if (this.descriptionMesh) {
            this.descriptionMesh.lookAt(camera.position);
            const labelHeight = this.descriptionMesh.userData.height || 1;
            const GAP = 0.5; // Default gap
            const x = this.mesh ? this.mesh.position.x : this.position.x;
            const y = this.mesh ? this.mesh.position.y : this.position.y;
            const z = this.mesh ? this.mesh.position.z : this.position.z;

            this.descriptionMesh.position.set(
                x,
                y + meshHeight / 2 + GAP + labelHeight / 2,
                z
            );
        }
    }
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
        if (this._cachedHeight !== undefined) {
            return this._cachedHeight;
        }
        if (!this.mesh) {
            // Fallback to metadata size height or default
            return this.metadata?.size?.height ?? 1.0;
        }

        this.mesh.geometry.computeBoundingBox();
        this._cachedHeight = this.mesh.geometry.boundingBox
            ? this.mesh.geometry.boundingBox.max.y - this.mesh.geometry.boundingBox.min.y
            : 1.0;
        return this._cachedHeight;
    }

    /**
     * Clean up resources (geometries, materials)
     */
    public dispose(): void {
        if (!this.mesh) return;

        if (this.mesh.geometry) { this.mesh.geometry.dispose(); }

        const materials = Array.isArray(this.mesh.material)
            ? this.mesh.material
            : [this.mesh.material];

        materials.forEach(m => {
            m.dispose();
        });
    }

    protected setEmissive(colorHex: number): void {
        if (!this.mesh) return;
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
     * Convert to the Pure DTO for external use.
     * Must be implemented by subclasses to provided specific schemas.
     */
    public abstract toDTO(): CodeEntityDTO;

    /**
     * Convert to the CodeObject interface expected by legacy systems/DependencyManager
     * @deprecated Use `toDTO` for external transfer or `this` (RenderableEntity) for internal renderer usage.
     */
    public toCodeObject(): RenderableEntity {
        return this;
    }

    /**
     * @deprecated Use `toDTO` instead.
     */
    public toCodeEntityDTO(): RenderableEntity {
        return this;
    }
}
