/**
 * Manages code objects in the 3D scene.
 * Core responsibilities: object CRUD, selection, and descriptions.
 */
import * as THREE from 'three';
import { RenderableEntity, DependencyDTO } from './types';
import { ThemeColors, CodeEntityDTO } from '../shared/types';
// DependencyManager removed
import { VisualObject } from './objects/visual-object';
import { FileObject } from './objects/file-object';
import { SignObject } from './objects/sign-object';
import { ArchitectureWarning, getWarningsByFile } from '../core/analysis';

/** Data for adding a new object */
export interface AddObjectData {
    id: string;
    type: 'file' | 'module' | 'class' | 'function' | 'sign';
    filePath: string;
    position: { x: number; y: number; z: number };
    color?: number;
    size?: { width?: number; height?: number; depth?: number };
    metadata?: any;
    description?: string;
    descriptionStatus?: string;
    descriptionLastUpdated?: string;
}

export class CodeObjectManager {
    // Store VisualObjects instead of raw interfaces
    private objects: Map<string, VisualObject> = new Map();
    // private dependencyManager: DependencyManager; // Removed

    /**
     * Get the internal objects map (Internal use for other managers)
     */
    public getInternalObjectsMap(): Map<string, VisualObject> {
        return this.objects;
    }

    private readonly GAP = 0.5;

    private readonly GROUND_Y = 0;

    constructor(private scene: THREE.Scene) {
        // this.dependencyManager = new DependencyManager(scene); // Removed
    }

    public addObject(data: AddObjectData): void {
        const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
        let visualObject: VisualObject;

        // Factory logic
        if (data.type === 'sign') {
            // Ensure filePath is passed if available
            // Also ensure description is passed!
            const signData = {
                ...data.metadata,
                filePath: data.filePath,
                description: data.description
            };
            visualObject = new SignObject(data.id, data.type, position, signData);
        } else {
            // Pass everything needed for file object
            // We nest data.metadata under 'metadata' key because FileObject expects it there
            // (to distinguish between visual size and file size, and to access content)
            const fileData = {
                metadata: data.metadata,
                filePath: data.filePath,
                color: data.color,
                size: data.size, // Visual size (dimensions)
                description: data.description,
                descriptionStatus: data.descriptionStatus,
                descriptionLastUpdated: data.descriptionLastUpdated
            };
            visualObject = new FileObject(data.id, data.type, position, fileData);
        }

        // Adjust Y position based on height
        // Adjust Y position based on height
        const meshHeight = visualObject.getHeight();

        // All objects float at eye level (center of object at camera height)
        // Camera Y = groundHeight(0.5) + characterHeight(1.8) + characterHeight*0.9(1.62) ≈ 3.92
        const EYE_LEVEL_Y = 3.9;

        // Prevent tall objects from clipping into ground
        // Bottom of object = centerY - height/2, must be >= GROUND_Y
        const minY = this.GROUND_Y + meshHeight / 2;
        visualObject.mesh.position.setY(Math.max(EYE_LEVEL_Y, minY));

        // Sync position back to object state
        visualObject.position.copy(visualObject.mesh.position);

        this.scene.add(visualObject.mesh);
        this.objects.set(data.id, visualObject);

        // Post-creation initialization (labels, etc)
        // All VisualObjects that support labels should implement this
        if (typeof (visualObject as any).initializeLabel === 'function') {
            (visualObject as any).initializeLabel(this.scene);
        }

        // Apply current theme if one exists
        if (this.currentTheme) {
            visualObject.updateTheme(this.currentTheme);
        }
    }

    public applyDescription(filePath: string, description: { summary: string; status: string; lastUpdated?: string }): void {
        const obj = [...this.objects.values()].find(o => o.metadata.filePath === filePath);

        // Allow any object that supports label updates to receive them
        if (obj && typeof (obj as any).updateLabel === 'function') {
            (obj as any).updateLabel(this.scene, description.summary);

            // Update metadata to persist status
            obj.metadata.descriptionStatus = description.status;
            obj.metadata.descriptionLastUpdated = description.lastUpdated;
        }
    }

    private updateQueue: VisualObject[] = [];
    private isProcessingQueue = false;
    private currentTheme?: ThemeColors;

    public updateTheme(theme: ThemeColors): void {
        this.currentTheme = theme;
        // Clear existing queue to avoid double work
        this.updateQueue = [];
        this.objects.forEach(obj => {
            // IMMEDIATE update for lightweight things (frames, labels)
            // But texture generation (heavy) should be deferred?
            // Current FileObject.updateTheme does both.
            // Let's call updateTheme immediately for structural color changes,
            // BUT FileObject needs to know to DEFER texture generation.
            // Actually, let's just stagger the whole call. Frame color changes are cheap but 
            // having them ripple is fine visually.
            this.updateQueue.push(obj);
        });

        if (!this.isProcessingQueue) {
            this.processUpdateQueue();
        }
    }

    private processUpdateQueue(): void {
        if (this.updateQueue.length === 0) {
            this.isProcessingQueue = false;
            return;
        }

        this.isProcessingQueue = true;
        const startTime = performance.now();
        const FRAME_BUDGET_MS = 10; // Target ~10ms per frame to leave room for rendering

        while (this.updateQueue.length > 0) {
            // Check budget
            if (performance.now() - startTime > FRAME_BUDGET_MS) {
                // Yield to next frame if budget exceeded
                requestAnimationFrame(() => this.processUpdateQueue());
                return;
            }

            const obj = this.updateQueue.shift();
            if (obj && obj.mesh.parent && this.currentTheme) {
                obj.updateTheme(this.currentTheme);
            }
        }

        // Queue finished
        this.isProcessingQueue = false;
    }

    public removeObject(id: string): void {
        const obj = this.objects.get(id);
        if (obj) {
            this.scene.remove(obj.mesh);
            obj.dispose();

            // Clean up label if it's a file object
            if (obj instanceof FileObject && obj.descriptionMesh) {
                this.scene.remove(obj.descriptionMesh);
            }

            this.objects.delete(id);
        }
    }

    public updateObjectPosition(id: string, position: { x: number; y: number; z: number }): void {
        const obj = this.objects.get(id);
        if (!obj) return;

        // Update stored position
        obj.position.set(position.x, position.y, position.z);

        // Update mesh position (handling floating height)
        const meshHeight = obj.getHeight();
        const EYE_LEVEL_Y = 3.9;
        const minY = this.GROUND_Y + meshHeight / 2;

        // Code objects float; we ignore the incoming Y usually (it's often just 0 or passed from generic layout)
        // Unless we want to support true 3D layout later. For now, enforce floating logic.
        const y = Math.max(EYE_LEVEL_Y, minY);

        obj.mesh.position.set(position.x, y, position.z);
    }

    public clear(): void {
        this.objects.forEach(obj => {
            this.scene.remove(obj.mesh);
            obj.dispose();
            if (obj instanceof FileObject && obj.descriptionMesh) {
                this.scene.remove(obj.descriptionMesh);
            }
        });
        this.objects.clear();
        // this.dependencyManager.clear(); // Handled externally
    }

    // Dependency delegation





    // Queries
    public findByMesh(mesh: THREE.Mesh): VisualObject | undefined {
        // Direct lookup via userData if available (optimization)
        if (mesh.userData.visualObject) {
            return mesh.userData.visualObject as VisualObject;
        }
        return [...this.objects.values()].find(o => o.mesh === mesh);
    }

    public getObjectMeshes(): THREE.Object3D[] {
        return [...this.objects.values()].map(o => o.mesh);
    }


    /** Get the number of objects */
    public getObjectCount(): number {
        return this.objects.size;
    }

    /** Get all objects iterator */
    public getObjects(): IterableIterator<RenderableEntity> {
        // Yield converted objects for compatibility
        // In future, consumers should use VisualObject
        return function* (objects: Map<string, VisualObject>) {
            for (const obj of objects.values()) {
                yield obj.toCodeObject();
            }
        }(this.objects);
    }

    public updateDescriptions(camera: THREE.Camera): void {
        this.objects.forEach(obj => {
            if (obj.descriptionMesh) {
                if (obj.descriptionMesh) {
                    obj.updateLabelPosition(camera);
                }
            }

            // Animate objects
            // Use a fixed delta or calculate it if possible, but updateDescriptions is called in render loop
            // We can approximate or just pass a time
            const now = performance.now() / 1000;
            obj.animate(now, 0.016); // Approx 60fps delta, or pass real delta if available
        });
    }



}

