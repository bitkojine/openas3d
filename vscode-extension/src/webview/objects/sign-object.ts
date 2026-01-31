import * as THREE from 'three';
import { ThemeColors, CodeEntityDTO, SignEntityDTO } from '../../shared/types';
import { VisualObject } from './visual-object';
import { createTextSprite } from '../texture-factory';

export class SignObject extends VisualObject {

    private sceneRef?: THREE.Scene;

    protected createMesh(): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.2, 1.0, 0.1);
        const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    public update(data: Record<string, unknown>): void {
        // Signs might update text or position
        this.metadata = { ...this.metadata, ...data };
    }

    public updateTheme(theme: ThemeColors): void {
        // Update post color?
        const mesh = this.mesh as THREE.Mesh;
        if (mesh.material) {
            const mat = mesh.material as THREE.MeshLambertMaterial;
            mat.color.set(theme.signPost);
        }

        // Update label
        if (this.sceneRef) {
            this.updateLabel(this.sceneRef, this.getDescriptionText(), theme);
        }
    }

    public initializeLabel(scene: THREE.Scene): void {
        this.sceneRef = scene;
        const text = (this.metadata.description as string | undefined) || 'Sign';
        this.updateLabel(scene, text);
    }

    public updateLabel(scene: THREE.Scene, text: string, theme?: ThemeColors): void {
        this.sceneRef = scene;

        if (this.descriptionMesh) {
            scene.remove(this.descriptionMesh);
            if (this.descriptionMesh.material.map) this.descriptionMesh.material.map.dispose();
            this.descriptionMesh.material.dispose();
        }

        // Just basic text for signs
        const sprite = createTextSprite(text || 'Sign', theme);

        const meshHeight = 1.0; // Fixed height from createMesh
        const labelHeight = sprite.userData.height || 1;

        sprite.position.set(
            this.position.x,
            this.position.y + meshHeight / 2 + 0.5 + labelHeight / 2, // 0.5 GAP
            this.position.z
        );

        if (sprite.userData.width && sprite.userData.height) {
            sprite.scale.set(sprite.userData.width, sprite.userData.height, 1);
        }

        this.descriptionMesh = sprite;
        scene.add(sprite);

        this.description = text;
        this.metadata.description = text;
    }

    private getDescriptionText(): string {
        return this.description || (this.metadata.description as string | undefined) || 'Sign';
    }

    // Duplicate helper from texture-factory needed here or passed in?
    // Actually texture-factory functions are exported. We can import them.
    // But to avoid huge diffs, let's copy the imports first.

    // Wait, I need to add imports to the top of the file first.
    // Let's rely on the user to add imports? No, I must do it.
    // I will use a separate replace_file_content for imports.
    // For now, assume createTextSprite is available or I need to import it.

    // Changing plan: I will do imports + class body update in one go with multi_replace if needed, 
    // or just assume I can add imports at top.

    // Let's pretend I have the import. I will add it in next step.

    public toDTO(): SignEntityDTO {
        return {
            id: this.id,
            type: 'sign',
            position: { x: this.position.x, y: this.position.y, z: this.position.z },
            text: (this.metadata.description as string | undefined) || 'Sign',
            metadata: {
                description: this.description,
                ...this.metadata
            }
        };
    }
}
