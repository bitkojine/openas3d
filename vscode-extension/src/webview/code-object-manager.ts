import * as THREE from 'three';
import { CodeObject, DependencyEdge } from './types';

export class CodeObjectManager {
    private objects: Map<string, CodeObject> = new Map();
    private dependencies: Map<string, DependencyEdge> = new Map();
    private selectedObject: CodeObject | null = null;

    private readonly GROUND_Y = 0;
    private readonly GAP = 0.5;

    constructor(private scene: THREE.Scene) {}

    private getFilename(filePath: string): string {
        const parts = filePath.split(/[\\/]/);
        return parts[parts.length - 1];
    }

    /** Create a placeholder texture with text for testing */
    private createPlaceholderTexture(text: string): THREE.Texture {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d')!;

        // Fill background
        ctx.fillStyle = '#222';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw white text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        return texture;
    }

    public addObject(data: {
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
    }): void {
        let geometry: THREE.BoxGeometry;
        let mesh: THREE.Mesh;

        if (data.type === 'sign') {
            geometry = new THREE.BoxGeometry(0.2, 1.0, 0.1);
            const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
            mesh = new THREE.Mesh(geometry, material);
        } else {
            const width = (data.size?.width || 1) * 0.5;
            const height = (data.size?.height || 1) * 0.5;
            const depth = (data.size?.depth || 1) * 0.5;

            geometry = new THREE.BoxGeometry(width, height, depth);

            const placeholderTexture = this.createPlaceholderTexture('CODE');

            const materials = [
                new THREE.MeshLambertMaterial({ color: data.color || 0x4caf50 }),
                new THREE.MeshLambertMaterial({ color: data.color || 0x4caf50 }),
                new THREE.MeshLambertMaterial({ color: data.color || 0x4caf50 }),
                new THREE.MeshLambertMaterial({ color: data.color || 0x4caf50 }),
                new THREE.MeshBasicMaterial({ map: placeholderTexture }),
                new THREE.MeshBasicMaterial({ map: placeholderTexture })
            ];

            mesh = new THREE.Mesh(geometry, materials);
        }

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox!;
        const meshHeight = bbox.max.y - bbox.min.y;

        // Set Y so bottom is always at GROUND_Y + GAP
        mesh.position.set(
            data.position.x,
            this.GROUND_Y + this.GAP + meshHeight / 2,
            data.position.z
        );
        this.scene.add(mesh);

        // ───── Description ─────
        let descriptionText = data.description;
        if (!descriptionText && data.metadata) {
            const meta = data.metadata;
            descriptionText = [
                `Filename: ${this.getFilename(data.filePath)}`,
                `Language: ${meta.language || 'unknown'}`,
                `Size: ${meta.size ?? 0} bytes`,
                `Complexity: ${meta.complexity ?? 'N/A'}`,
                `Last Modified: ${meta.lastModified ? new Date(meta.lastModified).toLocaleDateString() : 'unknown'}`
            ].join('\n');
        }

        const descriptionStatus = data.descriptionStatus || 'missing';
        const descriptionLastUpdated = data.descriptionLastUpdated || new Date().toISOString();

        const descriptionSprite = this.createTextSprite(descriptionText || 'No description');

        const labelHeight = descriptionSprite.userData.height || 1;

        descriptionSprite.position.set(
            mesh.position.x,
            mesh.position.y + meshHeight / 2 + this.GAP + labelHeight / 2,
            mesh.position.z
        );
        this.scene.add(descriptionSprite);

        const codeObject: CodeObject = {
            id: data.id,
            type: data.type,
            filePath: data.filePath,
            position: new THREE.Vector3(mesh.position.x, mesh.position.y, mesh.position.z),
            mesh,
            metadata: data.metadata || {},
            description: descriptionText || 'No description',
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

        this.scene.remove(obj.descriptionMesh);
        const newSprite = this.createTextSprite(description.summary);

        const mesh = obj.mesh;
        mesh.geometry.computeBoundingBox();
        const bbox = mesh.geometry.boundingBox!;
        const meshHeight = bbox.max.y - bbox.min.y;

        const labelHeight = newSprite.userData.height || 1;
        const gap = this.GAP;

        newSprite.position.set(
            obj.position.x,
            mesh.position.y + meshHeight / 2 + gap + labelHeight / 2,
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

    public updateDescriptions(camera: THREE.Camera): void {
        const gap = this.GAP;
        this.objects.forEach(obj => {
            if (obj.descriptionMesh) {
                obj.descriptionMesh.lookAt(camera.position);

                const mesh = obj.mesh;
                mesh.geometry.computeBoundingBox();
                const bbox = mesh.geometry.boundingBox!;
                const meshHeight = bbox.max.y - bbox.min.y;

                const labelHeight = obj.descriptionMesh.userData.height || 1;

                obj.descriptionMesh.position.set(
                    obj.position.x,
                    mesh.position.y + meshHeight / 2 + gap + labelHeight / 2,
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

    private getDependencyColor(type: 'import' | 'extends' | 'calls'): number {
        switch (type) {
            case 'import': return 0x00bfff;
            case 'extends': return 0xff6b35;
            case 'calls': return 0x32cd32;
            default: return 0x888888;
        }
    }

    private createTextSprite(message: string): THREE.Sprite {
        const canvasWidth = 512;
        const padding = 10;
        const fontSize = 36;
        const lineHeight = fontSize * 1.2;

        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.font = `${fontSize}px Arial`;

        const rawLines = message.split('\n');
        const lines: string[] = [];
        const maxTextWidth = canvasWidth - padding * 2;

        rawLines.forEach(rawLine => {
            const words = rawLine.split(' ');
            let currentLine = '';
            words.forEach((word, idx) => {
                const testLine = currentLine ? currentLine + ' ' + word : word;
                const metrics = tempCtx.measureText(testLine);
                if (metrics.width > maxTextWidth) {
                    if (currentLine) lines.push(currentLine);
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
                if (idx === words.length - 1) lines.push(currentLine);
            });
        });

        const canvasHeight = padding * 2 + lines.length * lineHeight;
        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d')!;
        ctx.font = `${fontSize}px Arial`;
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        let y = padding;
        lines.forEach(line => {
            ctx.fillStyle = 'white';
            ctx.fillText(line, padding, y);
            y += lineHeight;
        });

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;

        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: false });
        const sprite = new THREE.Sprite(spriteMaterial);

        sprite.userData.width = canvasWidth / 200;
        sprite.userData.height = canvasHeight / 200;
        sprite.scale.set(sprite.userData.width, sprite.userData.height, 1);

        return sprite;
    }

    public getSelectedObject(): CodeObject | null {
        return this.selectedObject;
    }
}
