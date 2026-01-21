import * as THREE from 'three';
import { VisualObject } from './visual-object';
import { CodeObject } from '../types';
import { getLanguageColor } from '../../utils/languageRegistry';
import { createContentTexture, createTextSprite, createTextSpriteWithDeps, LabelDependencyStats } from '../texture-factory';

export class FileObject extends VisualObject {
    // Configurable gap between box and label
    private readonly GAP = 0.5;

    protected createMesh(): THREE.Mesh {
        // Create geometry based on size in metadata or default
        const width = this.metadata.size?.width ?? 1;
        const height = this.metadata.size?.height ?? 1;
        const depth = this.metadata.size?.depth ?? 1;

        const geometry = new THREE.BoxGeometry(width, height, depth);

        // Calculate materials
        const content = this.metadata.metadata?.content || '';
        const lang = this.metadata.metadata?.language?.toLowerCase() || 'other';
        const contentTexture = createContentTexture(content);
        const color = this.metadata.color ?? getLanguageColor(lang);

        const materials = [
            new THREE.MeshLambertMaterial({ color }), // right
            new THREE.MeshLambertMaterial({ color }), // left
            new THREE.MeshLambertMaterial({ color }), // top
            new THREE.MeshLambertMaterial({ color }), // bottom
            new THREE.MeshBasicMaterial({ map: contentTexture }), // front
            new THREE.MeshBasicMaterial({ map: contentTexture })  // back
        ];

        const mesh = new THREE.Mesh(geometry, materials);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    /**
     * Post-creation initialization to add label.
     * We do this separate from constructor so we can pass scene if needed, 
     * but mainly to keep constructor simple.
     */
    public initializeLabel(scene: THREE.Scene): void {
        const descriptionText = this.getDescriptionText();
        this.updateLabel(scene, descriptionText);
    }

    public update(data: any): void {
        // Handle updates (e.g. content change, size change)
        // For now, we mainly update metadata
        this.metadata = { ...this.metadata, ...data };
        if (data.filePath) this.filePath = data.filePath;
    }

    public updateLabel(scene: THREE.Scene, text: string, stats?: LabelDependencyStats): void {
        if (this.descriptionMesh) {
            scene.remove(this.descriptionMesh);
        }

        const sprite = stats
            ? createTextSpriteWithDeps(text, stats)
            : createTextSprite(text || 'No description');

        const meshHeight = this.getHeight();
        const labelHeight = sprite.userData.height || 1;

        sprite.position.set(
            this.position.x,
            this.position.y + meshHeight / 2 + this.GAP + labelHeight / 2,
            this.position.z
        );

        if (sprite.userData.width && sprite.userData.height) {
            sprite.scale.set(sprite.userData.width, sprite.userData.height, 1);
        }

        this.descriptionMesh = sprite;
        scene.add(sprite);

        // Update local metadata tracking and base class state
        this.description = text;
        this.metadata.description = text;
    }

    private getDescriptionText(): string {
        if (this.description && this.description !== 'No description') return this.description;
        if (this.metadata.description) return this.metadata.description;

        // Fallback to metadata-based description
        if (this.metadata.metadata) {
            const meta = this.metadata.metadata;
            return [
                `Filename: ${this.getFilename(this.filePath)}`,
                `Language: ${meta.language || 'unknown'}`,
                `Size: ${(meta.size ?? 0).toLocaleString('lt-LT')} bytes`,
                `Complexity: ${meta.complexity ?? 'N/A'}`,
                `Last Modified: ${meta.lastModified ? new Date(meta.lastModified).toLocaleDateString('lt-LT', { timeZone: 'Europe/Vilnius' }) : 'unknown'}`
            ].join('\n');
        }

        return 'No description';
    }

    private getFilename(filePath: string): string {
        if (!filePath) return 'unknown';
        const parts = filePath.split(/[\\/]/);
        return parts[parts.length - 1];
    }



    public override dispose(): void {
        super.dispose();
        // Dispose label texture if present
        if (this.descriptionMesh) {
            if (this.descriptionMesh.material.map) {
                this.descriptionMesh.material.map.dispose();
            }
            this.descriptionMesh.material.dispose();
        }
    }
}
