
import * as THREE from 'three';
import { ZoneDTO } from '../core/domain/zone';
import { ThemeColors } from '../shared/types';
import { addZoneVisuals, removeZoneVisuals, createParkFoundation } from './zone-visuals';
import { createPathwayTexture, createEnhancedGrassTexture } from './environment';

/**
 * Manages zone visuals (signs, fences) in the 3D scene.
 */
export class ZoneManager {
    constructor(private scene: THREE.Scene) { }

    /**
     * Set zone bounds and create visual markers (signs and fences).
     * Replaces any existing zone visuals.
     */
    public updateZones(zones: ZoneDTO[]): void {
        // Remove previous zone visuals if any
        removeZoneVisuals(this.scene);

        // Add new zone signs and fences
        addZoneVisuals(this.scene, zones);

        // Add Park Plaza Foundation (paved area connecting zones)
        const foundation = createParkFoundation(zones);
        if (foundation) {
            this.scene.add(foundation);
        }
    }

    public updateTheme(theme: ThemeColors): void {
        // We need to update visuals.
        // Option 1: Regenerate everything (expensive but easy)
        // Option 2: Traverse and update materials (efficient)

        // 1. Update Park Foundation Texture
        const foundation = this.scene.getObjectByName('parkFoundation') as THREE.Mesh;
        if (foundation) {
            const mat = foundation.material as THREE.MeshLambertMaterial;
            if (mat.map) {
                mat.map.dispose();
                mat.map = createPathwayTexture(theme);
                mat.map.needsUpdate = true;
            }
        }

        // 2. Update Zone Grass Floors
        const allVisuals = this.scene.getObjectByName('zoneVisuals');
        if (allVisuals) {
            allVisuals.traverse((obj) => {
                if (obj instanceof THREE.Mesh) {
                    // Check for grass floor by logic? It's a plane geometry rotated -90.
                    // Or check position Y? Floor is at 0.02
                    if (obj.position.y === 0.02) {
                        const mat = obj.material as THREE.MeshLambertMaterial;
                        if (mat.map) {
                            // Recreate grass texture with theme
                            mat.map.dispose();
                            mat.map = createEnhancedGrassTexture(theme);
                            mat.map.needsUpdate = true;
                        }
                    }

                    // Update fences and signs based on parents?
                    // Rely on userData
                }

                // Use userData to identify groups
                if (obj.userData.type === 'zoneSign') {
                    // Update Sign Post and Board
                    obj.children.forEach(child => {
                        if (child instanceof THREE.Mesh) {
                            const mat = child.material;
                            // Heuristic: Post is Cylinder, Board is Box
                            if (child.geometry.type === 'CylinderGeometry') {
                                (mat as THREE.MeshLambertMaterial).color.set(theme.signPost);
                            } else if (child.geometry.type === 'BoxGeometry') {
                                if (Array.isArray(mat)) {
                                    // Edges/Sides
                                    mat.forEach(m => {
                                        if ((m as THREE.MeshLambertMaterial).color) {
                                            (m as THREE.MeshLambertMaterial).color.set(theme.signBoard);
                                        }
                                    });
                                }
                            }
                        }
                    });
                }

                if (obj.userData.type === 'zoneFence') {
                    // Update Posts and Rails
                    obj.children.forEach(child => {
                        if (child instanceof THREE.Mesh) {
                            const mat = child.material as THREE.MeshLambertMaterial;
                            if (child.geometry.type === 'CylinderGeometry') { // Post
                                mat.color.set(theme.fencePost);
                            } else { // Rail
                                mat.color.set(theme.fenceRail);
                            }
                        }
                    });
                }
            });
        }
    }

    public clear(): void {
        removeZoneVisuals(this.scene);
        const foundation = this.scene.getObjectByName('parkFoundation');
        if (foundation) {
            this.scene.remove(foundation);
            // Dispose logic if needed (geometry/material)
            if (foundation instanceof THREE.Mesh) {
                foundation.geometry.dispose();
                // Material might be shared, be careful. 
                // createPathwayTexture returns new instance? 
                // createPathwayTexture creates new canvas texture each time. So yes, dispose.
                if (foundation.material instanceof THREE.Material) {
                    foundation.material.dispose();
                    if ((foundation.material as any).map) (foundation.material as any).map.dispose();
                }
            }
        }
    }
}
