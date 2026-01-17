import * as THREE from 'three';
import { CodeObject, DependencyEdge } from './types';

export class CodeObjectManager {
    private objects: Map<string, CodeObject> = new Map();
    private dependencies: Map<string, DependencyEdge> = new Map();
    private selectedObject: CodeObject | null = null;

    constructor(private scene: THREE.Scene) {}

    public addObject(data: {
        id: string;
        type: 'file' | 'module' | 'class' | 'function';
        filePath: string;
        position: { x: number; y: number; z: number };
        color?: number;
        size?: { width?: number; height?: number; depth?: number };
        metadata?: any;
        description?: string;
        descriptionStatus?: string;
        descriptionLastUpdated?: string;
    }): void {
        const geometry = new THREE.BoxGeometry(
            data.size?.width || 1,
            data.size?.height || 1,
            data.size?.depth || 1
        );

        const material = new THREE.MeshLambertMaterial({
            color: data.color || 0x4caf50
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        this.scene.add(mesh);

        // Create placeholder description if none provided
        const descriptionText = data.description || 'No description yet...';
        const descriptionStatus = data.descriptionStatus || 'missing';
        const descriptionLastUpdated = data.descriptionLastUpdated || new Date().toISOString();

        const descriptionSprite = this.createTextSprite(descriptionText);

        // Position above object with uniform gap
        const gap = 0.5;
        const height = data.size?.height || 1;
        descriptionSprite.position.set(
            data.position.x,
            data.position.y + height + gap,
            data.position.z
        );

        this.scene.add(descriptionSprite);

        const codeObject: CodeObject = {
            id: data.id,
            type: data.type,
            filePath: data.filePath,
            position: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
            mesh,
            metadata: data.metadata || {},
            description: descriptionText,
            descriptionMesh: descriptionSprite,
            descriptionStatus,
            descriptionLastUpdated
        };

        this.objects.set(data.id, codeObject);
    }

    public applyDescription(filePath: string, description: { summary: string; status: string; lastUpdated?: string }): void {
        const obj = [...this.objects.values()].find(o => o.filePath === filePath);
        if (!obj || !obj.descriptionMesh) return;

        obj.description = description.summary;
        obj.descriptionStatus = description.status;
        obj.descriptionLastUpdated = description.lastUpdated || new Date().toISOString();

        // Remove old sprite and add new one
        this.scene.remove(obj.descriptionMesh);
        const newSprite = this.createTextSprite(`${description.summary}\n[${description.status}]`);

        // Keep same position
        newSprite.position.copy(obj.descriptionMesh.position);
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

        this.dependencies.forEach(dep => this.scene.remove(dep.line));
        this.dependencies.clear();

        this.selectedObject = null;
    }

    public addDependency(data: {
        id: string;
        source: string;
        target: string;
        type: 'import' | 'extends' | 'calls';
        color?: number;
        opacity?: number;
    }): void {
        const sourceObj = this.objects.get(data.source);
        const targetObj = this.objects.get(data.target);

        if (!sourceObj || !targetObj) {
            console.warn(`Cannot create dependency line: ${data.source} → ${data.target}`);
            return;
        }

        const points = [sourceObj.position.clone(), targetObj.position.clone()];
        const dir = targetObj.position.clone().sub(sourceObj.position).normalize();
        points[0].add(dir.clone().multiplyScalar(0.6));
        points[1].sub(dir.clone().multiplyScalar(0.6));

        const geometry = new THREE.BufferGeometry().setFromPoints(points);

        const material = new THREE.LineBasicMaterial({
            color: data.color || this.getDependencyColor(data.type),
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

    public removeDependency(id: string): void {
        const dep = this.dependencies.get(id);
        if (dep) {
            this.scene.remove(dep.line);
            this.dependencies.delete(id);
        }
    }

    public showDependenciesForObject(objectId: string): void {
        this.dependencies.forEach(dep => dep.line.visible = false);
        this.dependencies.forEach(dep => {
            if (dep.source === objectId || dep.target === objectId) {
                dep.line.visible = true;
                (dep.line.material as THREE.LineBasicMaterial).opacity = 0.9;
            }
        });
    }

    public showAllDependencies(): void {
        this.dependencies.forEach(dep => {
            dep.line.visible = true;
            (dep.line.material as THREE.LineBasicMaterial).opacity = 0.6;
        });
    }

    public hideDependencies(): void {
        this.dependencies.forEach(dep => dep.line.visible = false);
    }

    public selectObject(obj: CodeObject): void {
        this.deselectObject();

        this.selectedObject = obj;
        const material = obj.mesh.material as THREE.MeshLambertMaterial;
        material.emissive.setHex(0x444444);
    }

    public deselectObject(): void {
        if (this.selectedObject) {
            const material = this.selectedObject.mesh.material as THREE.MeshLambertMaterial;
            material.emissive.setHex(0x000000);
            this.selectedObject = null;
        }
    }

    public findByMesh(mesh: THREE.Mesh): CodeObject | undefined {
        return [...this.objects.values()].find(o => o.mesh === mesh);
    }

    public getObjectMeshes(): THREE.Object3D[] {
        return [...this.objects.values()].map(o => o.mesh);
    }

    /** Update all description meshes to face the camera and stay stable */
    public updateDescriptions(camera: THREE.Camera): void {
        const gap = 0.5; // uniform gap above object
        this.objects.forEach(obj => {
            if (obj.descriptionMesh) {
                obj.descriptionMesh.lookAt(camera.position);

                const height = obj.mesh.geometry.boundingBox
                    ? obj.mesh.geometry.boundingBox.max.y - obj.mesh.geometry.boundingBox.min.y
                    : 1;
                obj.descriptionMesh.position.set(
                    obj.position.x,
                    obj.position.y + height + gap,
                    obj.position.z
                );

                // fixed scale
                obj.descriptionMesh.scale.set(3, 1.5, 1);
            }
        });
    }

    private getDependencyColor(type: 'import' | 'extends' | 'calls'): number {
        switch (type) {
            case 'import': return 0x00bfff;
            case 'extends': return 0xff6b35;
            case 'calls': return 0x32cd32;
            default: return 0x888888;
        }
    }

    /** Helper: create text sprite, left-aligned, wraps, taller to fit text */
    private createTextSprite(message: string): THREE.Sprite {
        const canvasWidth = 1024;
        const canvasHeight = 512;

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        const context = canvas.getContext('2d')!;
        context.fillStyle = 'black';
        context.fillRect(0, 0, canvasWidth, canvasHeight);

        const fontSize = 48;
        context.font = `${fontSize}px Arial`;
        context.fillStyle = 'white';
        context.textAlign = 'left';
        context.textBaseline = 'top';

        const padding = 20;
        const maxTextWidth = canvasWidth - padding * 2;
        const words = message.split(' ');
        const lines: string[] = [];
        let currentLine = '';

        words.forEach((word, idx) => {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const metrics = context.measureText(testLine);
            if (metrics.width > maxTextWidth) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
            if (idx === words.length - 1) lines.push(currentLine);
        });

        const lineHeight = fontSize * 1.1; // slightly tighter
        let y = padding;
        for (const line of lines) {
            context.fillText(line, padding, y);
            y += lineHeight;
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: false });
        const sprite = new THREE.Sprite(spriteMaterial);

        // fixed 3D scale
        sprite.scale.set(3, 1.5, 1);

        return sprite;
    }

    public getSelectedObject(): CodeObject | null {
        return this.selectedObject;
    }
}
