/**
 * Manages code objects in the 3D scene.
 * Core responsibilities: object CRUD, selection, and descriptions.
 */
import * as THREE from 'three';
import { CodeObject, DependencyEdge } from './types';
import { getLanguageColor } from '../utils/languageRegistry';
import { createContentTexture, createTextSprite } from './texture-factory';
import { DependencyManager, DependencyData } from './dependency-manager';

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
    private objects: Map<string, CodeObject> = new Map();
    private dependencyManager: DependencyManager;
    private selectedObject: CodeObject | null = null;

    private readonly GROUND_Y = 0;
    private readonly GAP = 0.5;

    constructor(private scene: THREE.Scene) {
        this.dependencyManager = new DependencyManager(scene);
    }

    private getFilename(filePath: string): string {
        const parts = filePath.split(/[\\/]/);
        return parts[parts.length - 1];
    }

    private getMeshHeight(mesh: THREE.Mesh, type: string): number {
        mesh.geometry.computeBoundingBox();
        return mesh.geometry.boundingBox
            ? mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y
            : type === 'sign' ? 1.0 : 1;
    }

    private setEmissiveColor(obj: CodeObject, colorHex: number): void {
        const materials = Array.isArray(obj.mesh.material) ? obj.mesh.material : [obj.mesh.material];
        materials.forEach(mat => {
            if ((mat as THREE.MeshLambertMaterial).emissive) {
                (mat as THREE.MeshLambertMaterial).emissive.setHex(colorHex);
            }
        });
    }

    public addObject(data: AddObjectData): void {
        let geometry: THREE.BoxGeometry;
        let mesh: THREE.Mesh;

        if (data.type === 'sign') {
            geometry = new THREE.BoxGeometry(0.2, 1.0, 0.1);
            const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            mesh = new THREE.Mesh(geometry, material);
        } else {
            const width = data.size?.width ?? 1;
            const height = data.size?.height ?? 1;
            const depth = data.size?.depth ?? 1;

            geometry = new THREE.BoxGeometry(width, height, depth);

            const content = data.metadata?.content || '';
            const lang = data.metadata?.language?.toLowerCase() || 'other';
            const contentTexture = createContentTexture(content);
            const color = data.color ?? getLanguageColor(lang);

            const materials = [
                new THREE.MeshLambertMaterial({ color }), // right
                new THREE.MeshLambertMaterial({ color }), // left
                new THREE.MeshLambertMaterial({ color }), // top
                new THREE.MeshLambertMaterial({ color }), // bottom
                new THREE.MeshBasicMaterial({ map: contentTexture }), // front
                new THREE.MeshBasicMaterial({ map: contentTexture })  // back
            ];

            mesh = new THREE.Mesh(geometry, materials);
        }

        const meshHeight = this.getMeshHeight(mesh, data.type);

        mesh.position.set(
            data.position.x,
            this.GROUND_Y + this.GAP + meshHeight / 2,
            data.position.z
        );

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Create description sprite
        let descriptionText = data.description;
        if (!descriptionText && data.metadata) {
            const meta = data.metadata;
            descriptionText = [
                `Filename: ${this.getFilename(data.filePath)}`,
                `Language: ${meta.language || 'unknown'}`,
                `Size: ${(meta.size ?? 0).toLocaleString('lt-LT')} bytes`,
                `Complexity: ${meta.complexity ?? 'N/A'}`,
                `Last Modified: ${meta.lastModified ? new Date(meta.lastModified).toLocaleDateString('lt-LT', { timeZone: 'Europe/Vilnius' }) : 'unknown'}`
            ].join('\n');
        }

        const descriptionSprite = createTextSprite(descriptionText || 'No description');
        const labelHeight = descriptionSprite.userData.height || 1;
        descriptionSprite.position.set(
            data.position.x,
            mesh.position.y + meshHeight / 2 + this.GAP + labelHeight / 2,
            data.position.z
        );
        this.scene.add(descriptionSprite);

        const codeObject: CodeObject = {
            id: data.id,
            type: data.type,
            filePath: data.filePath,
            position: new THREE.Vector3(data.position.x, mesh.position.y, data.position.z),
            mesh,
            metadata: data.metadata || {},
            description: descriptionText || 'No description',
            descriptionMesh: descriptionSprite,
            descriptionStatus: data.descriptionStatus || 'missing',
            descriptionLastUpdated: data.descriptionLastUpdated || new Date().toISOString()
        };

        this.objects.set(data.id, codeObject);
    }

    public applyDescription(filePath: string, description: { summary: string; status: string; lastUpdated?: string }): void {
        const obj = [...this.objects.values()].find(o => o.filePath === filePath);
        if (!obj || !obj.descriptionMesh) return;

        obj.description = description.summary;
        obj.descriptionStatus = description.status;
        obj.descriptionLastUpdated = description.lastUpdated || new Date().toISOString();

        this.scene.remove(obj.descriptionMesh);
        const newSprite = createTextSprite(description.summary);

        const meshHeight = this.getMeshHeight(obj.mesh, obj.type);
        const labelHeight = newSprite.userData.height || 1;
        newSprite.position.set(
            obj.position.x,
            obj.mesh.position.y + meshHeight / 2 + this.GAP + labelHeight / 2,
            obj.position.z
        );

        obj.descriptionMesh = newSprite;
        this.scene.add(newSprite);
    }

    public removeObject(id: string): void {
        const obj = this.objects.get(id);
        if (obj) {
            this.scene.remove(obj.mesh);
            if (obj.descriptionMesh) this.scene.remove(obj.descriptionMesh);
            this.objects.delete(id);
            if (this.selectedObject?.id === id) this.selectedObject = null;
        }
    }

    public clear(): void {
        this.objects.forEach(obj => {
            this.scene.remove(obj.mesh);
            if (obj.descriptionMesh) this.scene.remove(obj.descriptionMesh);
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

    // Selection management
    public selectObject(obj: CodeObject): void {
        this.deselectObject();
        this.selectedObject = obj;
        this.setEmissiveColor(obj, 0x444444);
    }

    public deselectObject(): void {
        if (this.selectedObject) {
            this.setEmissiveColor(this.selectedObject, 0x000000);
            this.selectedObject = null;
        }
    }

    public setFocusedObject(obj: CodeObject | null): void {
        if (this.selectedObject === obj) return;
        if (this.selectedObject) {
            this.setEmissiveColor(this.selectedObject, 0x000000);
        }
        this.selectedObject = obj;
        if (this.selectedObject) {
            this.setEmissiveColor(this.selectedObject, 0xaaaaaa);
        }
    }

    // Queries
    public findByMesh(mesh: THREE.Mesh): CodeObject | undefined {
        return [...this.objects.values()].find(o => o.mesh === mesh);
    }

    public getObjectMeshes(): THREE.Object3D[] {
        return [...this.objects.values()].map(o => o.mesh);
    }

    public getSelectedObject(): CodeObject | null {
        return this.selectedObject;
    }

    /** Get the number of objects */
    public getObjectCount(): number {
        return this.objects.size;
    }

    /** Get all objects iterator */
    public getObjects(): IterableIterator<CodeObject> {
        return this.objects.values();
    }

    public updateDescriptions(camera: THREE.Camera): void {
        this.objects.forEach(obj => {
            if (obj.descriptionMesh) {
                obj.descriptionMesh.lookAt(camera.position);

                const meshHeight = this.getMeshHeight(obj.mesh, obj.type);
                const labelHeight = obj.descriptionMesh.userData.height || 1;

                obj.descriptionMesh.position.set(
                    obj.position.x,
                    obj.mesh.position.y + meshHeight / 2 + this.GAP + labelHeight / 2,
                    obj.position.z
                );

                if (obj.descriptionMesh.userData.width && obj.descriptionMesh.userData.height) {
                    obj.descriptionMesh.scale.set(
                        obj.descriptionMesh.userData.width,
                        obj.descriptionMesh.userData.height,
                        1
                    );
                }
            }
        });
    }
}
