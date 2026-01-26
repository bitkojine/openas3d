import * as THREE from 'three';
import { createTextSprite } from '../texture-factory';

export interface MonumentConfig {
    color: number;
    shape: 'box' | 'sphere' | 'torus' | 'cylinder';
    rotationSpeed: number;
    label: string;
}

export class HotReloadMonument {
    private group: THREE.Group;
    private mesh: THREE.Mesh | null = null;
    private label: THREE.Sprite | null = null;
    private config: MonumentConfig;

    constructor(config: MonumentConfig) {
        this.group = new THREE.Group();
        this.config = config;
        this.createOrUpdate(config);
    }

    public getObject(): THREE.Group {
        return this.group;
    }

    public update(config: MonumentConfig) {
        this.config = config;
        this.createOrUpdate(config);
    }

    private createOrUpdate(config: MonumentConfig) {
        // Clear existing mesh
        if (this.mesh) {
            this.group.remove(this.mesh);
            this.mesh.geometry.dispose();
            (this.mesh.material as THREE.Material).dispose();
        }

        // Create Geometry
        let geometry: THREE.BufferGeometry;
        switch (config.shape) {
            case 'sphere':
                geometry = new THREE.SphereGeometry(2, 32, 32);
                break;
            case 'torus':
                geometry = new THREE.TorusGeometry(1.5, 0.5, 16, 100);
                break;
            case 'cylinder':
                geometry = new THREE.CylinderGeometry(1.5, 1.5, 3, 32);
                break;
            case 'box':
            default:
                geometry = new THREE.BoxGeometry(3, 3, 3);
                break;
        }

        // Create Material with a glow effect
        const material = new THREE.MeshPhongMaterial({
            color: config.color,
            emissive: config.color,
            emissiveIntensity: 0.5,
            transparent: true,
            opacity: 0.8,
            shininess: 100
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.group.add(this.mesh);

        // Position at center but slightly elevated
        this.group.position.set(0, 5, 0);

        // Update or create label
        if (this.label) {
            this.group.remove(this.label);
        }
        this.label = createTextSprite(config.label || 'Hot Reload Monument');
        this.label.position.set(0, 4, 0);
        this.group.add(this.label);
    }

    public animate(deltaTime: number) {
        if (this.mesh) {
            this.mesh.rotation.y += this.config.rotationSpeed * deltaTime * 60;
            this.mesh.rotation.x += this.config.rotationSpeed * 0.5 * deltaTime * 60;

            // Subtle pulse
            const pulse = 1.0 + Math.sin(Date.now() * 0.002) * 0.1;
            this.mesh.scale.set(pulse, pulse, pulse);
        }
    }
}
