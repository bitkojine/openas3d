/**
 * Manages code objects in the 3D scene.
 * Core responsibilities: object CRUD, selection, and descriptions.
 */
import * as THREE from 'three';
import { CodeEntityDTO, DependencyDTO } from './types';
import { DependencyManager, DependencyData, DependencyStats } from './dependency-manager';
import { VisualObject } from './objects/visual-object';
import { FileObject } from './objects/file-object';
import { SignObject } from './objects/sign-object';

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
    private dependencyManager: DependencyManager;
    private selectedObject: VisualObject | null = null;
    private focusedObject: VisualObject | null = null; // Track hover focus

    private readonly GROUND_Y = 0;

    public setFocusedObject(obj: VisualObject | null): void {
        if (this.focusedObject === obj) { return; }

        // Reset previous focus
        if (this.focusedObject && this.focusedObject !== this.selectedObject) {
            this.focusedObject.setInteractionState(false);
        }

        this.focusedObject = obj;

        // Set new focus
        if (this.focusedObject && this.focusedObject !== this.selectedObject) {
            this.focusedObject.setInteractionState(true);
        }
    }

    public getFocusedObject(): CodeEntityDTO | null {
        return this.focusedObject ? this.focusedObject.toCodeObject() : null;
    }

    private readonly GAP = 0.5;

    constructor(private scene: THREE.Scene) {
        this.dependencyManager = new DependencyManager(scene);
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
        const meshHeight = visualObject.getHeight();
        visualObject.mesh.position.setY(
            this.GROUND_Y + this.GAP + meshHeight / 2
        );
        // Sync position back to object state
        visualObject.position.copy(visualObject.mesh.position);

        this.scene.add(visualObject.mesh);
        this.objects.set(data.id, visualObject);

        // Post-creation initialization (labels, etc)
        // All VisualObjects that support labels should implement this
        if (typeof (visualObject as any).initializeLabel === 'function') {
            (visualObject as any).initializeLabel(this.scene);
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
            if (this.selectedObject?.id === id) { this.selectedObject = null; }
        }
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
        this.dependencyManager.clear();
        this.selectedObject = null;
    }

    // Dependency delegation
    public addDependency(data: DependencyData): void {
        this.dependencyManager.add(data, this.objects);
    }

    public removeDependency(id: string): void {
        this.dependencyManager.remove(id);
    }

    public showDependenciesForObject(objectId: string): void {
        this.dependencyManager.showForObject(objectId);
    }

    public showAllDependencies(): void {
        this.dependencyManager.showAll();
    }

    public hideDependencies(): void {
        this.dependencyManager.hideAll();
    }

    /** Get total number of dependency edges */
    public getDependencyCount(): number {
        return this.dependencyManager.getDependencyCount();
    }

    /** Get all dependency edges */
    public getAllDependencies(): IterableIterator<DependencyDTO> {
        return this.dependencyManager.getAll();
    }

    /** Get count of circular dependencies */
    public getCircularCount(): number {
        return this.dependencyManager.getCircularCount();
    }

    /** Get dependency stats for a specific object */
    public getDependencyStats(objectId: string): DependencyStats {
        return this.dependencyManager.getStatsForObject(objectId);
    }

    /** Update dependency animations */
    public updateDependencies(deltaTime: number): void {
        this.dependencyManager.update(deltaTime);
    }

    // Selection management
    public selectObject(obj: VisualObject): void { // Changed signature to VisualObject
        this.deselectObject();
        this.selectedObject = obj;
        obj.select();
    }

    public deselectObject(): void {
        if (this.selectedObject) {
            this.selectedObject.deselect();
            this.selectedObject = null;
        }
    }



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

    public getSelectedObject(): CodeEntityDTO | null {
        return this.selectedObject ? this.selectedObject.toCodeObject() : null;
    }

    /** Get the number of objects */
    public getObjectCount(): number {
        return this.objects.size;
    }

    /** Get all objects iterator */
    public getObjects(): IterableIterator<CodeEntityDTO> {
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
                obj.descriptionMesh.lookAt(camera.position);

                // Recalculate position in case size changed or just to be safe
                const meshHeight = obj.getHeight();
                const labelHeight = obj.descriptionMesh.userData.height || 1;
                // Check if it's sign or file for gap?? 
                // VisualObject could have getGap()? 
                // For now, assume consistent GAP logic or reuse obj specific logic?
                // Actually, objects should probably handle their own billboarding if placement is complex.
                // But CodeObjectManager traditionally did this.
                // Let's stick to simple centering:

                obj.descriptionMesh.position.set(
                    obj.position.x,
                    obj.mesh.position.y + meshHeight / 2 + this.GAP + labelHeight / 2,
                    obj.position.z
                );
            }
        });
    }

    /**
     * Refresh all object labels with dependency statistics.
     * Call this after all dependencies have been added.
     */
    public refreshLabelsWithDependencyStats(): void {
        this.objects.forEach(obj => {
            if (obj instanceof FileObject) {
                const stats = this.dependencyManager.getStatsForObject(obj.id);
                if (stats.incoming === 0 && stats.outgoing === 0) { return; }

                // Re-creating the label with stats
                // We need the original description text. FileObject can regenerate it.
                // But FileObject.updateLabel takes a string. 
                // Let's trust FileObject to handle this if we pass stats.

                // For now, simple approach:
                // We need to pass stats to FileObject, let it handle the factory call
                const labelStats = {
                    incoming: stats.incoming,
                    outgoing: stats.outgoing,
                    hasCircular: stats.circularWith.length > 0
                };

                // Get current description text (hidden state in FileObject, let's peek metadata)
                const text = obj.metadata.description || 'No description'; // We might lose auto-generated description here if not saved

                // Better: rely on FileObject interna 'getDescriptionText()' if we could.
                // As a quick fix, we call updateLabel with current metadata description.
                obj.updateLabel(this.scene, text, labelStats);
            }
        });
    }
}

