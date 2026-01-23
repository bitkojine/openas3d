
import * as THREE from 'three';
import { ZoneDTO } from '../core/domain/zone';
import { addZoneVisuals, removeZoneVisuals, createParkFoundation } from './zone-visuals';

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
