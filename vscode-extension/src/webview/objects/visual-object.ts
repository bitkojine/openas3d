/**
 * Abstract base class for all 3D objects in the scene.
 * Enforces a common contract for creation, updates, and lifecycle management.
 * Implements RenderableEntity interface for compatibility with existing systems.
 */
import * as THREE from 'three';
import { RenderableEntity } from '../types';
import { ThemeColors, CodeEntityDTO } from '../../shared/types';

export abstract class VisualObject implements RenderableEntity {
    public mesh: THREE.Mesh;
    public id: string;
    public type: 'file' | 'module' | 'class' | 'function' | 'sign';
    public position: THREE.Vector3;
    public metadata: Record<string, unknown>; // Using unknown for safer metadata access

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

    constructor(id: string, type: 'file' | 'module' | 'class' | 'function' | 'sign', position: THREE.Vector3, metadata: Record<string, unknown> = {}) {
        this.id = id;
        this.type = type;
        this.position = position;
        this.metadata = metadata;
        const meta = metadata;
        this.filePath = (meta.filePath as string) || '';
        this.description = (meta.description as string) || 'No description';

        // Initialize description state from metadata if present
        if (meta.descriptionStatus) { this.descriptionStatus = meta.descriptionStatus as 'missing' | 'generated' | 'reconciled'; }
        if (meta.descriptionLastUpdated) { this.descriptionLastUpdated = meta.descriptionLastUpdated as string; }

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
    public abstract update(data: Record<string, unknown>): void;

    /**
     * Update the object appearance based on the theme
     */
    public abstract updateTheme(theme: ThemeColors): void;

    /**
     * Animate the object (called per frame)
     */
    public animate(time: number, deltaTime: number): void {
        // Optional override
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
            this.descriptionMesh.position.set(
                this.mesh.position.x,
                this.mesh.position.y + meshHeight / 2 + GAP + labelHeight / 2,
                this.mesh.position.z
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
