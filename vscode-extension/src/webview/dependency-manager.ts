/**
 * Manages dependency lines between code objects in the 3D scene.
 * Provides curved bezier lines, arrows, circular dependency detection,
 * and animated flow effects.
 */
import * as THREE from 'three';
import { CodeEntityDTO, DependencyDTO, ImportKind } from './types';
import { VisualObject } from './objects/visual-object';

/** Dependency type for import/extends/calls relationships */
export type DependencyType = 'import' | 'extends' | 'calls';

/** Dependency creation data */
export interface DependencyData {
    id: string;
    source: string;
    target: string;
    type: DependencyType;
    weight?: number;
    isCircular?: boolean;
    importKind?: ImportKind;
    color?: number;
    opacity?: number;
}

/** Dependency statistics for an object */
export interface DependencyStats {
    /** Number of files this object imports */
    outgoing: number;
    /** Number of files that import this object */
    incoming: number;
    /** IDs of circular dependency partners */
    circularWith: string[];
}

/** Colors for dependency types and states */
const DEPENDENCY_COLORS = {
    import: 0x00bfff,     // Cyan
    extends: 0xff6b35,    // Orange
    calls: 0x32cd32,      // Green
    typeOnly: 0x87ceeb,   // Light blue
    reexport: 0xffa500,   // Orange
    circular: 0xff4444,   // Red warning
    default: 0x888888
};

/** Get color for dependency based on type and state */
export function getDependencyColor(type: DependencyType, importKind?: ImportKind, isCircular?: boolean): number {
    if (isCircular) { return DEPENDENCY_COLORS.circular; }
    if (importKind === 'type') { return DEPENDENCY_COLORS.typeOnly; }
    if (importKind === 'reexport') { return DEPENDENCY_COLORS.reexport; }

    switch (type) {
        case 'import': return DEPENDENCY_COLORS.import;
        case 'extends': return DEPENDENCY_COLORS.extends;
        case 'calls': return DEPENDENCY_COLORS.calls;
        default: return DEPENDENCY_COLORS.default;
    }
}

/**
 * Create a curved line with arrow between two points
 */
function createCurvedLineWithArrow(
    start: THREE.Vector3,
    end: THREE.Vector3,
    color: number,
    opacity: number,
    weight: number = 1,
    isCircular: boolean = false,
    importKind?: ImportKind
): THREE.Group {
    const group = new THREE.Group();

    // Calculate control point for quadratic bezier (arc upward)
    const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const direction = new THREE.Vector3().subVectors(end, start);
    const distance = direction.length();

    // Control point rises above midpoint for nice arc
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    const arcHeight = Math.min(distance * 0.3, 2);
    const controlPoint = midPoint.clone().add(new THREE.Vector3(0, arcHeight, 0));

    // Offset for circular dependencies (side by side)
    if (isCircular) {
        controlPoint.add(perpendicular.clone().multiplyScalar(0.5));
    }

    // Create bezier curve
    const curve = new THREE.QuadraticBezierCurve3(start, controlPoint, end);
    const points = curve.getPoints(32);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Line thickness based on weight (1-5 scale)
    const lineWidth = Math.min(1 + (weight - 1) * 0.5, 3);

    // Dash pattern for type-only imports
    let lineMaterial: THREE.Material;
    if (importKind === 'type') {
        lineMaterial = new THREE.LineDashedMaterial({
            color,
            opacity,
            transparent: true,
            dashSize: 0.2,
            gapSize: 0.1,
            linewidth: lineWidth
        });
    } else {
        lineMaterial = new THREE.LineBasicMaterial({
            color,
            opacity,
            transparent: true,
            linewidth: lineWidth
        });
    }

    const line = new THREE.Line(geometry, lineMaterial);
    if (importKind === 'type') {
        line.computeLineDistances(); // Required for dashed lines
    }
    group.add(line);

    // Create arrow at the end
    const arrowLength = 0.3;
    const arrowWidth = 0.15;
    const arrowGeometry = new THREE.ConeGeometry(arrowWidth, arrowLength, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({
        color,
        opacity,
        transparent: true
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);

    // Position arrow at end and orient along curve tangent
    const tangent = curve.getTangent(1);
    arrow.position.copy(end);
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    // Move arrow slightly back along tangent so it ends at the target
    arrow.position.sub(tangent.clone().multiplyScalar(arrowLength / 2));
    group.add(arrow);

    // Add glow for circular dependencies
    if (isCircular) {
        const glowGeometry = new THREE.BufferGeometry().setFromPoints(points);
        const glowMaterial = new THREE.LineBasicMaterial({
            color: DEPENDENCY_COLORS.circular,
            opacity: 0.3,
            transparent: true,
            linewidth: lineWidth + 2
        });
        const glowLine = new THREE.Line(glowGeometry, glowMaterial);
        glowLine.name = 'glow';
        group.add(glowLine);
    }

    // Store animation data
    group.userData.animationPhase = Math.random() * Math.PI * 2;
    group.userData.isCircular = isCircular;

    return group;
}

/**
 * Manages dependency lines between code objects
 */
export class DependencyManager {
    private dependencies: Map<string, DependencyDTO> = new Map();
    private objectStats: Map<string, DependencyStats> = new Map();
    private animationTime: number = 0;

    constructor(private scene: THREE.Scene) { }

    /**
     * Add a dependency line between two objects
     */
    public add(
        data: DependencyData,
        objects: Map<string, VisualObject>
    ): void {
        const sourceObj = objects.get(data.source);
        const targetObj = objects.get(data.target);

        if (!sourceObj || !targetObj) {
            return; // Skip if source or target not found
        }

        // Calculate start/end positions with slight offset from object centers
        const start = sourceObj.mesh.position.clone();
        const end = targetObj.mesh.position.clone();
        const dir = end.clone().sub(start).normalize();
        start.add(dir.clone().multiplyScalar(0.6));
        end.sub(dir.clone().multiplyScalar(0.6));

        const weight = data.weight ?? 1;
        const isCircular = data.isCircular ?? false;
        const importKind = data.importKind ?? 'value';
        const color = data.color ?? getDependencyColor(data.type, importKind, isCircular);
        const opacity = data.opacity ?? (isCircular ? 0.9 : 0.7);

        const lineGroup = createCurvedLineWithArrow(
            start, end, color, opacity, weight, isCircular, importKind
        );

        this.scene.add(lineGroup);

        const dep: DependencyDTO = {
            id: data.id,
            source: data.source,
            target: data.target,
            type: data.type,
            weight,
            isCircular,
            importKind,
            line: lineGroup
        };

        this.dependencies.set(data.id, dep);

        // Update stats
        this.updateStats(data.source, data.target, isCircular);
    }

    /**
     * Update dependency statistics for objects
     */
    private updateStats(sourceId: string, targetId: string, isCircular: boolean): void {
        // Source stats (outgoing)
        if (!this.objectStats.has(sourceId)) {
            this.objectStats.set(sourceId, { outgoing: 0, incoming: 0, circularWith: [] });
        }
        const sourceStats = this.objectStats.get(sourceId)!;
        sourceStats.outgoing++;
        if (isCircular && !sourceStats.circularWith.includes(targetId)) {
            sourceStats.circularWith.push(targetId);
        }

        // Target stats (incoming)
        if (!this.objectStats.has(targetId)) {
            this.objectStats.set(targetId, { outgoing: 0, incoming: 0, circularWith: [] });
        }
        const targetStats = this.objectStats.get(targetId)!;
        targetStats.incoming++;
        if (isCircular && !targetStats.circularWith.includes(sourceId)) {
            targetStats.circularWith.push(sourceId);
        }
    }

    /**
     * Get dependency statistics for an object
     */
    public getStatsForObject(objectId: string): DependencyStats {
        return this.objectStats.get(objectId) || { outgoing: 0, incoming: 0, circularWith: [] };
    }

    /**
     * Get total dependency count
     */
    public getDependencyCount(): number {
        return this.dependencies.size;
    }

    /**
     * Get count of circular dependencies
     */
    public getCircularCount(): number {
        let count = 0;
        this.dependencies.forEach(dep => {
            if (dep.isCircular) { count++; }
        });
        // Divide by 2 since circular deps are counted for both directions
        return Math.floor(count / 2);
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
        this.dependencies.forEach(dep => {
            const isConnected = dep.source === objectId || dep.target === objectId;
            dep.line.visible = isConnected;
            if (isConnected) {
                // Brighten connected dependencies
                dep.line.children.forEach(child => {
                    if ((child as THREE.Line).material) {
                        const mat = (child as THREE.Line).material as THREE.LineBasicMaterial;
                        if (child.name !== 'glow') {
                            mat.opacity = 0.95;
                        }
                    }
                });
            }
        });
    }

    /**
     * Show all dependencies
     */
    public showAll(): void {
        this.dependencies.forEach(dep => {
            dep.line.visible = true;
            dep.line.children.forEach(child => {
                if ((child as THREE.Line).material) {
                    const mat = (child as THREE.Line).material as THREE.LineBasicMaterial;
                    if (child.name !== 'glow') {
                        mat.opacity = dep.isCircular ? 0.9 : 0.7;
                    }
                }
            });
        });
    }

    /**
     * Hide all dependencies
     */
    public hideAll(): void {
        this.dependencies.forEach(dep => dep.line.visible = false);
    }

    /**
     * Update animations (call each frame)
     */
    public update(deltaTime: number): void {
        this.animationTime += deltaTime;

        // Pulse animation for circular dependencies
        this.dependencies.forEach(dep => {
            if (dep.isCircular && dep.line.visible) {
                const phase = dep.line.userData.animationPhase || 0;
                const pulse = 0.5 + 0.5 * Math.sin(this.animationTime * 3 + phase);

                dep.line.children.forEach(child => {
                    if (child.name === 'glow') {
                        const mat = (child as THREE.Line).material as THREE.LineBasicMaterial;
                        mat.opacity = 0.2 + pulse * 0.4;
                    }
                });
            }
        });
    }

    /**
     * Clear all dependencies
     */
    public clear(): void {
        this.dependencies.forEach(dep => this.scene.remove(dep.line));
        this.dependencies.clear();
        this.objectStats.clear();
    }

    /**
     * Get all dependency edges
     */
    public getAll(): IterableIterator<DependencyDTO> {
        return this.dependencies.values();
    }
}
