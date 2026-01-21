/**
 * Manages dependency lines between code objects in the 3D scene.
 */
import * as THREE from 'three';
import { CodeObject, DependencyEdge } from './types';

/** Dependency type for import/extends/calls relationships */
export type DependencyType = 'import' | 'extends' | 'calls';

/** Dependency creation data */
export interface DependencyData {
    id: string;
    source: string;
    target: string;
    type: DependencyType;
    color?: number;
    opacity?: number;
}

/** Get color for dependency type */
export function getDependencyColor(type: DependencyType): number {
    switch (type) {
        case 'import': return 0x00bfff;
        case 'extends': return 0xff6b35;
        case 'calls': return 0x32cd32;
        default: return 0x888888;
    }
}

/**
 * Manages dependency lines between code objects
 */
export class DependencyManager {
    private dependencies: Map<string, DependencyEdge> = new Map();

    constructor(private scene: THREE.Scene) { }

    /**
     * Add a dependency line between two objects
     */
    public add(
        data: DependencyData,
        objects: Map<string, CodeObject>
    ): void {
        const sourceObj = objects.get(data.source);
        const targetObj = objects.get(data.target);

        if (!sourceObj || !targetObj) {
            console.warn(`Cannot create dependency line: ${data.source} → ${data.target}`);
            return;
        }

        const points = [
            sourceObj.mesh.position.clone(),
            targetObj.mesh.position.clone()
        ];

        const dir = targetObj.mesh.position.clone().sub(sourceObj.mesh.position).normalize();
        points[0].add(dir.clone().multiplyScalar(0.6));
        points[1].sub(dir.clone().multiplyScalar(0.6));

        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const material = new THREE.LineBasicMaterial({
            color: data.color || getDependencyColor(data.type),
            opacity: data.opacity || 0.6,
            transparent: true,
            linewidth: 2
        });

        const line = new THREE.Line(geometry, material);
        this.scene.add(line);

        const dep: DependencyEdge = {
            id: data.id,
            source: data.source,
            target: data.target,
            type: data.type,
            line
        };

        this.dependencies.set(data.id, dep);
    }

    /**
     * Remove a dependency line
     */
    public remove(id: string): void {
        const dep = this.dependencies.get(id);
        if (dep) {
            this.scene.remove(dep.line);
            this.dependencies.delete(id);
        }
    }

    /**
     * Show only dependencies connected to a specific object
     */
    public showForObject(objectId: string): void {
        this.dependencies.forEach(dep => dep.line.visible = false);
        this.dependencies.forEach(dep => {
            if (dep.source === objectId || dep.target === objectId) {
                dep.line.visible = true;
                (dep.line.material as THREE.LineBasicMaterial).opacity = 0.9;
            }
        });
    }

    /**
     * Show all dependencies
     */
    public showAll(): void {
        this.dependencies.forEach(dep => {
            dep.line.visible = true;
            (dep.line.material as THREE.LineBasicMaterial).opacity = 0.6;
        });
    }

    /**
     * Hide all dependencies
     */
    public hideAll(): void {
        this.dependencies.forEach(dep => dep.line.visible = false);
    }

    /**
     * Clear all dependencies
     */
    public clear(): void {
        this.dependencies.forEach(dep => this.scene.remove(dep.line));
        this.dependencies.clear();
    }
}
