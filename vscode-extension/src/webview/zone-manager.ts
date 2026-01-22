
import * as THREE from 'three';
import { ZoneDTO } from '../core/domain/zone';
import { addZoneVisuals, removeZoneVisuals } from './zone-visuals';

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
    }

    public clear(): void {
        removeZoneVisuals(this.scene);
    }
}
