import * as THREE from 'three';
import { VisualObject } from './visual-object';
import { createTextSprite } from '../texture-factory';

export class SignObject extends VisualObject {

    protected createMesh(): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(0.2, 1.0, 0.1);
        const material = new THREE.MeshLambertMaterial({ color: 0x8B4513 });
        const mesh = new THREE.Mesh(geometry, material);

        mesh.castShadow = true;
        mesh.receiveShadow = true;

        return mesh;
    }

    public update(data: any): void {
        // Signs might update text or position
        this.metadata = { ...this.metadata, ...data };
    }

    public initializeLabel(scene: THREE.Scene): void {
        if (this.metadata.description) {
            this.updateLabel(scene, this.metadata.description);
        }
    }

    public updateLabel(scene: THREE.Scene, text: string): void {
        if (this.descriptionMesh) {
            scene.remove(this.descriptionMesh);
        }

        // Just basic text for signs
        const sprite = this.createTextSprite(text || 'Sign');

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
    private createTextSprite(text: string): THREE.Sprite {
        return createTextSprite(text);
    }
}
