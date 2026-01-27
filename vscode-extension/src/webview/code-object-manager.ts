/**
 * Manages code objects in the 3D scene.
 * Core responsibilities: object CRUD, selection, and descriptions.
 */
import * as THREE from 'three';
import { RenderableEntity } from './types';
import { ThemeColors } from '../shared/types';
import { VisualObject } from './objects/visual-object';
import { FileObject } from './objects/file-object';
import { SignObject } from './objects/sign-object';
import { InstanceManager } from './instance-manager';

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
    private objects: Map<string, VisualObject> = new Map();
    private instanceManager: InstanceManager;
    private _objectsArrayCache: RenderableEntity[] | null = null;

    // Proximity threshold for "active" objects (high detail)
    private readonly PROMOTION_DISTANCE = 40;
    private readonly GROUND_Y = 0;
    private readonly EYE_LEVEL_Y = 3.9;

    private currentTheme?: ThemeColors;
    private updateQueue: VisualObject[] = [];
    private isProcessingQueue = false;

    constructor(private scene: THREE.Scene) {
        this.instanceManager = new InstanceManager(scene);
    }

    public getInternalObjectsMap(): Map<string, VisualObject> {
        return this.objects;
    }

    public getObject(id: string): VisualObject | undefined {
        return this.objects.get(id);
    }

    public addObject(data: AddObjectData): void {
        const position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
        let visualObject: VisualObject;

        if (data.type === 'sign') {
            const signData = { ...data.metadata, filePath: data.filePath, description: data.description };
            visualObject = new SignObject(data.id, data.type, position, signData);
        } else {
            const fileData = {
                metadata: data.metadata,
                filePath: data.filePath,
                color: data.color,
                size: data.size,
                description: data.description,
                descriptionStatus: data.descriptionStatus,
                descriptionLastUpdated: data.descriptionLastUpdated
            };
            visualObject = new FileObject(data.id, data.type, position, fileData);
        }

        // Adjust Y position based on height (even for instanced boxes)
        const meshHeight = visualObject.getHeight();
        const minY = this.GROUND_Y + meshHeight / 2;
        visualObject.position.setY(Math.max(this.EYE_LEVEL_Y, minY));

        // Add to instance manager for distant rendering
        this.instanceManager.addInstance(
            data.id,
            visualObject.position,
            meshHeight,
            data.color ?? 0x333333
        );

        this.objects.set(data.id, visualObject);
        this._objectsArrayCache = null;

        if (this.currentTheme) {
            visualObject.updateTheme(this.currentTheme);
        }
    }

    public applyDescription(filePath: string, description: { summary: string; status: string; lastUpdated?: string }): void {
        const obj = [...this.objects.values()].find(o => o.metadata.filePath === filePath);
        if (obj && typeof (obj as any).updateLabel === 'function') {
            (obj as any).updateLabel(this.scene, description.summary);
            obj.metadata.descriptionStatus = description.status;
            obj.metadata.descriptionLastUpdated = description.lastUpdated;
        }
    }

    public updateTheme(theme: ThemeColors): void {
        this.currentTheme = theme;
        this.updateQueue = [...this.objects.values()];
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
        const FRAME_BUDGET_MS = 8; // Leave room for rendering

        while (this.updateQueue.length > 0) {
            if (performance.now() - startTime > FRAME_BUDGET_MS) {
                requestAnimationFrame(() => this.processUpdateQueue());
                return;
            }

            const obj = this.updateQueue.shift();
            if (obj && this.currentTheme) {
                obj.updateTheme(this.currentTheme);
            }
        }
        this.isProcessingQueue = false;
    }

    public removeObject(id: string): void {
        const obj = this.objects.get(id);
        if (obj) {
            if (obj.isPromoted) obj.demote(this.scene);
            this.instanceManager.setVisibility(id, false);
            this.objects.delete(id);
            this._objectsArrayCache = null;
        }
    }

    public updateObjectPosition(id: string, position: { x: number; y: number; z: number }): void {
        const obj = this.objects.get(id);
        if (!obj) return;

        obj.position.set(position.x, position.y, position.z);
        const meshHeight = obj.getHeight();
        const minY = this.GROUND_Y + meshHeight / 2;
        const y = Math.max(this.EYE_LEVEL_Y, minY);
        obj.position.setY(y);

        if (obj.isPromoted && obj.mesh) {
            obj.mesh.position.copy(obj.position);
        } else {
            this.instanceManager.updateInstance(id, obj.position, meshHeight);
        }
    }

    public updateObjectPositions(updates: { id: string; position: { x: number; y: number; z: number } }[]): void {
        updates.forEach(u => this.updateObjectPosition(u.id, u.position));
    }

    public clear(): void {
        this.objects.forEach(obj => {
            if (obj.isPromoted) obj.demote(this.scene);
        });
        this.instanceManager.dispose();
        this.instanceManager = new InstanceManager(this.scene);
        this.objects.clear();
        this._objectsArrayCache = null;
    }

    public findByMesh(mesh: THREE.Mesh): VisualObject | undefined {
        if (mesh.userData.visualObject) {
            return mesh.userData.visualObject as VisualObject;
        }
        return [...this.objects.values()].find(o => o.mesh === mesh);
    }

    public getObjectMeshes(): THREE.Object3D[] {
        return [...this.objects.values()]
            .map(o => o.mesh)
            .filter((m): m is THREE.Mesh => m !== undefined);
    }

    public getObjectCount(): number {
        return this.objects.size;
    }

    public getObjects(): RenderableEntity[] {
        if (!this._objectsArrayCache) {
            this._objectsArrayCache = [...this.objects.values()].map(obj => obj.toCodeObject());
        }
        return this._objectsArrayCache;
    }

    private lastLODCheck = 0;
    private readonly LOD_CHECK_INTERVAL = 200; // ms, faster check

    public updateLOD(camera: THREE.Camera): void {
        const now = performance.now();
        if (now - this.lastLODCheck < this.LOD_CHECK_INTERVAL) return;
        this.lastLODCheck = now;

        const cameraPos = camera.position;

        this.objects.forEach(obj => {
            const distance = obj.position.distanceTo(cameraPos);

            if (distance < this.PROMOTION_DISTANCE) {
                if (!obj.isPromoted) {
                    obj.promote(this.scene);
                    this.instanceManager.setVisibility(obj.id, false);
                }
                obj.updateLabelPosition(camera);
            } else {
                if (obj.isPromoted) {
                    obj.demote(this.scene);
                    this.instanceManager.setVisibility(obj.id, true);
                    // Ensure instance is up to date since it was hidden
                    this.instanceManager.updateInstance(obj.id, obj.position, obj.getHeight());
                }
            }
        });
    }

    public updateAnimations(now: number, deltaTime: number): void {
        this.objects.forEach(obj => {
            if (obj.isPromoted) {
                obj.animate(now, deltaTime);
            }
        });
    }
}
