/**
 * Manages dependency lines between code objects in the 3D scene.
 * Provides curved tubes with animated flow textures, arrows, and circular dependency detection.
 */
import * as THREE from 'three';
import { DependencyDTO, ImportKind } from './types';
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

/** Shared flow texture for all dependencies */
let _flowTexture: THREE.Texture | null = null;
function getFlowTexture(): THREE.Texture {
    if (_flowTexture) { return _flowTexture; }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 1;
    const ctx = canvas.getContext('2d')!;

    const gradient = ctx.createLinearGradient(0, 0, 64, 0);
    // Flow pattern: Use Alpha for transparency, keep color white
    // When modulated with Vertex Color (Red/Green), white preserves the color, 
    // while alpha handles the "pulse" visibility.
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.1)');   // Faint
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)'); // Moderate
    gradient.addColorStop(0.8, 'rgba(255, 255, 255, 0.9)'); // Solid (Brightest point of pulse)
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.1)');   // Faint

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 1);

    _flowTexture = new THREE.CanvasTexture(canvas);
    _flowTexture.wrapS = THREE.RepeatWrapping;
    _flowTexture.wrapT = THREE.RepeatWrapping;
    // Anisotropy helps when looking at the tube from shallow angles
    _flowTexture.anisotropy = 4;

    return _flowTexture;
}

/**
 * Create a curved tube with flow animation and arrow
 */
function createCurvedTubeWithArrow(
    start: THREE.Vector3,
    end: THREE.Vector3,
    color: number,
    opacity: number,
    weight: number = 1,
    isCircular: boolean = false,
    importKind?: ImportKind
): THREE.Group {
    const group = new THREE.Group();

    // Calculate control points for Cubic Bezier (Steep Rocket Arch)
    // Start -> Up -> ... -> Down -> End
    const up = new THREE.Vector3(0, 1, 0);
    const direction = new THREE.Vector3().subVectors(end, start);
    const distance = direction.length();

    // Scale height based on distance but clamp it preventing it from being too huge
    // But user wants "extreme", "rocket take off", "steap angle".
    // So we use a significant vertical scalar.
    const heightScale = Math.max(distance * 0.5, 4);

    const controlPoint1 = start.clone().add(up.clone().multiplyScalar(heightScale));
    const controlPoint2 = end.clone().add(up.clone().multiplyScalar(heightScale));

    // Offset for circular dependencies
    if (isCircular) {
        const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
        const offset = perpendicular.multiplyScalar(0.8);
        controlPoint1.add(offset);
        controlPoint2.add(offset);
    }

    // Create Cubic Bezier curve
    const curve = new THREE.CubicBezierCurve3(start, controlPoint1, controlPoint2, end);

    // Create Tube Geometry
    // Radius based on weight but clamped
    const radius = Math.max(0.02, Math.min(0.08, 0.02 * weight));
    const segments = 24; // Smooth curve
    const radialSegments = 6; // Hexagonal cross-section is enough for thin tubes
    const geometry = new THREE.TubeGeometry(curve, segments, radius, radialSegments, false);

    // --- Vertex colors for gradient ---
    const count = (geometry.attributes.position as any).count || (segments + 1) * (radialSegments + 1);
    const colors = new Float32Array(count * 3);

    // Red (Source) -> Green (Target)
    const startColor = new THREE.Color(0xff0000); // Red
    const endColor = new THREE.Color(0x00ff00);   // Green

    const numRings = segments + 1;
    const vertsPerRing = radialSegments + 1;

    for (let i = 0; i < numRings; i++) {
        const alpha = i / segments;
        const r = startColor.r + (endColor.r - startColor.r) * alpha;
        const g = startColor.g + (endColor.g - startColor.g) * alpha;
        const b = startColor.b + (endColor.b - startColor.b) * alpha;

        for (let j = 0; j < vertsPerRing; j++) {
            const index = (i * vertsPerRing + j) * 3;
            colors[index] = r;
            colors[index + 1] = g;
            colors[index + 2] = b;
        }
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    // Creates dashed effect via texture repetition
    // Higher repeat = more pulses
    const texture = getFlowTexture().clone(); // Clone to allow independent offset animation
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(4, 1); // 4 pulses along the line

    // Material
    const material = new THREE.MeshBasicMaterial({
        vertexColors: true, // Enable vertex gradients
        map: texture,       // Texture modulates alpha/opacity
        transparent: true,
        opacity: opacity,
        blending: THREE.NormalBlending, // Normal blending prevents white washout
        depthWrite: false, // Don't occlude other objects
        side: THREE.DoubleSide
    });

    const tube = new THREE.Mesh(geometry, material);
    tube.name = 'tube';
    group.add(tube);

    // Create arrow at the end
    const arrowLength = radius * 8;
    const arrowWidth = radius * 4;
    const arrowGeometry = new THREE.ConeGeometry(arrowWidth, arrowLength, 8);
    const arrowMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00, // Green to match target end of gradient
        transparent: true,
        opacity: Math.min(1, opacity + 0.2), // Arrow slightly more opaque
        depthWrite: false
    });
    const arrow = new THREE.Mesh(arrowGeometry, arrowMaterial);

    // Position arrow at end and orient along curve tangent
    const tangent = curve.getTangent(1);
    arrow.position.copy(end);
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
    // Move arrow back so tip touches target
    arrow.position.sub(tangent.clone().multiplyScalar(arrowLength * 0.5));
    group.add(arrow);

    // Store animation data
    // Randomize initial phase so they don't all pulse in sync
    group.userData.flowSpeed = isCircular ? 0.5 : 1.0;
    texture.offset.x = Math.random() * 10;

    // Store texture reference for animation
    group.userData.texture = texture;
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
     * Update dependency lines connected to a specific object
     */
    public updateObjectPosition(
        objectId: string,
        objects: Map<string, VisualObject>
    ): void {
        // Find existing deps connected to this object
        // We can't easily find them by ID without iterating all.
        // Optimization: In a real app we might index by objectId.
        // For now, iterate and rebuild if matching.

        // Collect IDs to rebuild to avoid modification during iteration issues
        const depsToRebuild: string[] = [];
        this.dependencies.forEach(dep => {
            if (dep.source === objectId || dep.target === objectId) {
                depsToRebuild.push(dep.id);
            }
        });

        depsToRebuild.forEach(depId => {
            const oldDep = this.dependencies.get(depId)!;
            // Capture data needed for recreation
            const data: DependencyData = {
                id: oldDep.id,
                source: oldDep.source,
                target: oldDep.target,
                type: oldDep.type,
                weight: oldDep.weight,
                isCircular: oldDep.isCircular,
                importKind: oldDep.importKind
                // ignoring color/opacity preservation for simplicity, 
                // defaulting to standard logic or we could extract it from material.
                // Standard logic is safer to ensure consistency.
            };

            // Remove old line
            this.remove(depId);

            // Add new line with new positions
            this.add(data, objects);
        });
    }

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

        // Calculate connection points (Ports) - Updated for "Center-Top Cluster"
        // Constraint: Objects rotate to face player. Keep points near center but separated.
        // Source (Outgoing): Right of center (+X)
        // Target (Incoming): Left of center (-X)

        const sourceHeight = sourceObj.getHeight();
        const targetHeight = targetObj.getHeight();

        // Get indices for distribution
        const sourceStats = this.getStatsForObject(data.source);
        const targetStats = this.getStatsForObject(data.target);

        const outIndex = sourceStats.outgoing;
        const inIndex = targetStats.incoming;

        // Visual Cluster Parameters
        const portSpacing = 0.05; // Tight spacing for "Header Pin" header look
        const centerOffset = 0.15; // Distance from true center to start of cluster

        // Calculate Start Position (Source: Center-Top + Right Offset)
        const start = sourceObj.position.clone();
        start.y += sourceHeight / 2; // Top surface
        // Offset to Right (+X). Stagger in Z to create a 2-row header if many deps
        start.x += centerOffset + (outIndex % 4) * portSpacing;
        start.z += Math.floor(outIndex / 4) * portSpacing;

        // Calculate End Position (Target: Center-Top - Left Offset)
        const end = targetObj.position.clone();
        end.y += targetHeight / 2; // Top surface
        // Offset to Left (-X)
        end.x -= centerOffset + (inIndex % 4) * portSpacing;
        end.z += Math.floor(inIndex / 4) * portSpacing;

        // Lift slightly to sit on top of mesh
        start.y += 0.02;
        end.y += 0.02;

        const weight = data.weight ?? 1;
        const isCircular = data.isCircular ?? false;
        const importKind = data.importKind ?? 'value';
        const color = data.color ?? getDependencyColor(data.type, importKind, isCircular);
        const opacity = data.opacity ?? (isCircular ? 0.8 : 0.6);

        const lineGroup = createCurvedTubeWithArrow(
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
            // Clean up meshes and materials
            dep.line.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                    child.geometry.dispose();
                    if (child.material instanceof THREE.Material) {
                        child.material.dispose();
                        // If we cloned the texture for this instance, dispose it
                        if (child.material instanceof THREE.MeshBasicMaterial && child.material.map && child.material.map !== _flowTexture) {
                            child.material.map.dispose();
                        }
                    }
                }
            });
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
                // Brighten/Opaquen connected dependencies
                dep.line.children.forEach(child => {
                    if ((child as THREE.Mesh).material) {
                        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
                        mat.opacity = 0.9;
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
                if ((child as THREE.Mesh).material) {
                    const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
                    // Reset opacity logic
                    mat.opacity = dep.isCircular ? 0.8 : 0.6;
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

        // Animate flow textures
        this.dependencies.forEach(dep => {
            if (dep.line.visible) {
                const texture = dep.line.userData.texture as THREE.Texture;
                const speed = dep.line.userData.flowSpeed || 1.0;

                // Move texture offset to create flow effect
                if (texture) {
                    texture.offset.x -= speed * deltaTime * 0.5; // Adjustable speed
                }
            }
        });
    }

    /**
     * Clear all dependencies and dispose resources
     */
    public dispose(): void {
        this.clear();
        if (_flowTexture) {
            _flowTexture.dispose();
            _flowTexture = null;
        }
    }

    /**
     * Clear all dependencies
     */
    public clear(): void {
        this.dependencies.forEach(dep => this.remove(dep.id));
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
