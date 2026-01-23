import * as THREE from 'three';
import { VisualObject } from './visual-object';
import { CodeEntityDTO } from '../types';
import { getLanguageColor } from '../../utils/languageRegistry';
import { createContentTexture, createTextSprite, createTextSpriteWithDeps, LabelDependencyStats, WrappedLine } from '../texture-factory';
import { ArchitectureWarning } from '../../core/analysis';
import { ThemeColors } from '../../shared/types';

export class FileObject extends VisualObject {
    // Configurable gap between box and label
    private readonly GAP = 0.5;
    private warningBadge: THREE.Sprite | null = null;

    // Mesh References
    private _frameMesh?: THREE.Mesh;
    private _barMesh?: THREE.Mesh;
    private _screenBack?: THREE.Mesh;

    // State for re-rendering labels
    private sceneRef?: THREE.Scene;
    private currentStats?: LabelDependencyStats;
    private cachedLines?: WrappedLine[];




    protected createMesh(): THREE.Mesh {
        // Create geometry based on size in metadata or default
        const width = this.metadata.size?.width ?? 1;
        const height = this.metadata.size?.height ?? 1;
        // Ignore cubic depth for visuals to achieve "smart display" look
        const HITBOX_DEPTH = 0.2;
        const FRAME_DEPTH = 0.1; // Very slim visual

        // 1. Root Mesh - Invisible HITBOX
        const rootGeometry = new THREE.BoxGeometry(width, height, HITBOX_DEPTH);
        const rootMaterial = new THREE.MeshBasicMaterial({
            visible: false
        });
        const rootMesh = new THREE.Mesh(rootGeometry, rootMaterial);

        // 2. Frame Mesh - The structure (Smart Display Body)
        // Slightly larger in W/H, very thin
        const frameGeometry = new THREE.BoxGeometry(width + 0.1, height + 0.1, FRAME_DEPTH);
        const frameTexture = this.createTechTexture(width + 0.1, height + 0.1);
        const frameMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff, // White base to show texture colors correctly
            emissive: 0x111111,
            map: frameTexture
        });
        const frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
        frameMesh.castShadow = true;
        frameMesh.receiveShadow = true;
        frameMesh.userData.visualObject = this;
        rootMesh.add(frameMesh);
        this._frameMesh = frameMesh;

        // 3. Content Screen - Front
        const content = this.metadata.metadata?.content || '';
        // Initial creation - cache lines
        const { texture: contentTexture, lines } = createContentTexture(content);
        this.cachedLines = lines;
        const screenGeometry = new THREE.PlaneGeometry(width * 0.9, height * 0.9);
        const screenMaterial = new THREE.MeshBasicMaterial({
            map: contentTexture,
            side: THREE.FrontSide,
            fog: false, // Ensure high contrast regardless of atmosphere
            toneMapped: false // Ensure sharp colors without grading
        });
        const screenFront = new THREE.Mesh(screenGeometry, screenMaterial);
        // Position slightly in front of frame
        screenFront.position.z = FRAME_DEPTH / 2 + 0.01;
        screenFront.userData.visualObject = this;
        rootMesh.add(screenFront);

        // 4. Content Screen - Back
        const screenBack = new THREE.Mesh(screenGeometry, screenMaterial);
        screenBack.rotation.y = Math.PI;
        screenBack.position.z = -(FRAME_DEPTH / 2 + 0.01);
        screenBack.userData.visualObject = this;
        rootMesh.add(screenBack);
        this._screenBack = screenBack;

        // 5. Status Bar / Connection Point
        // Top bezel/accent cap.
        const lang = this.metadata.metadata?.language?.toLowerCase() || 'other';
        const color = this.metadata.color ?? getLanguageColor(lang);

        // Make it a thin cap on top
        const barGeometry = new THREE.BoxGeometry(width + 0.1, height * 0.1, FRAME_DEPTH);
        const barMaterial = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 });
        const barMesh = new THREE.Mesh(barGeometry, barMaterial);
        barMesh.position.y = (height + 0.1) / 2 + (height * 0.1) / 2; // Sit exactly on top
        barMesh.userData.visualObject = this;
        rootMesh.add(barMesh);
        this._barMesh = barMesh;

        rootMesh.castShadow = true;
        rootMesh.receiveShadow = true;

        return rootMesh;
    }

    private createTechTexture(width: number, height: number): THREE.CanvasTexture {
        let canvas: HTMLCanvasElement;

        // Handle environment (Node vs Browser)
        if (typeof document !== 'undefined' && document.createElement) {
            canvas = document.createElement('canvas');
        } else {
            return new THREE.CanvasTexture(null as any);
        }

        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // Background
            ctx.fillStyle = '#222222';
            ctx.fillRect(0, 0, 512, 512);

            // Grid lines
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 2;
            const gridSize = 64;
            for (let i = 0; i <= 512; i += gridSize) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i, 512);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(0, i);
                ctx.lineTo(512, i);
                ctx.stroke();
            }

            // Tech details / Circuits
            ctx.fillStyle = '#1a1a1a';
            for (let i = 0; i < 20; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const w = Math.random() * 100 + 20;
                const h = Math.random() * 50 + 10;
                ctx.fillRect(x, y, w, h);
            }

            // Emissive accents (subtle)
            ctx.fillStyle = '#334455';
            for (let i = 0; i < 10; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                ctx.fillRect(x, y, 10, 10);
            }
        }

        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Post-creation initialization to add label.
     */
    public initializeLabel(scene: THREE.Scene): void {
        this.sceneRef = scene;
        const descriptionText = this.getDescriptionText();
        this.updateLabel(scene, descriptionText);
    }

    public update(data: any): void {
        this.metadata = { ...this.metadata, ...data };
        if (data.filePath) { this.filePath = data.filePath; }
    }

    public updateTheme(theme: ThemeColors): void {
        // Update Frame
        if (this._frameMesh) {
            const mat = this._frameMesh.material as THREE.MeshLambertMaterial;
            if (mat && mat.emissive) {
                // Use editor background logic to enhance visual
                const color = new THREE.Color(theme.editorBackground);
                if (color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.1) {
                    color.offsetHSL(0, 0, 0.1);
                }
                const emissive = new THREE.Color(theme.editorBackground).multiplyScalar(0.2);
                mat.emissive.copy(emissive);
            }
        }

        // Update Screen Back
        if (this._screenBack) {
            // Optional: Update back panel if we want to change its look
        }

        // Update Bar (Language Cap)
        if (this._barMesh) {
            const mat = this._barMesh.material as THREE.MeshLambertMaterial;
            if (mat) {
                // Ensure the bar stays visible and vibrant but fits the lighting
                const isDark = new THREE.Color(theme.editorBackground).getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;
                mat.emissiveIntensity = isDark ? 0.6 : 0.4;
            }
        }

        // Update Label
        if (this.sceneRef) {
            this.updateLabel(this.sceneRef, this.getDescriptionText(), this.currentStats, theme);
        }

        // Update Content Texture (Code Body)
        // We find the front screen mesh
        const screenFront = this.mesh.children.find(c => (c as THREE.Mesh).geometry && (c as THREE.Mesh).geometry.type === 'PlaneGeometry' && c.position.z > 0) as THREE.Mesh;
        if (screenFront) {
            const content = this.metadata.metadata?.content || '';
            // Re-create texture with theme, reusing cached layout if available
            const { texture: newTexture, lines } = createContentTexture(content, theme, this.cachedLines);
            // Update cache (though it should be the same if we passed it in)
            this.cachedLines = lines;

            // Dispose old texture
            const oldMat = screenFront.material as THREE.MeshBasicMaterial;
            if (oldMat.map) oldMat.map.dispose();

            // Update material
            oldMat.map = newTexture;
            oldMat.needsUpdate = true;

            // Also update back screen if we want (it matches front currently)
            if (this._screenBack) {
                const backMat = this._screenBack.material as THREE.MeshBasicMaterial;
                backMat.map = newTexture; // Share texture or clone? Sharing is fine if managed.
                backMat.needsUpdate = true;
            }
        }
    }

    public updateLabel(scene: THREE.Scene, text: string, stats?: LabelDependencyStats, theme?: ThemeColors): void {
        this.sceneRef = scene; // Update ref just in case
        this.currentStats = stats;

        if (this.descriptionMesh) {
            scene.remove(this.descriptionMesh);
            if (this.descriptionMesh.material.map) this.descriptionMesh.material.map.dispose();
            this.descriptionMesh.material.dispose();
        }

        const sprite = stats
            ? createTextSpriteWithDeps(text, stats, theme)
            : createTextSprite(text || 'No description', theme);

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
        if (this.description && this.description !== 'No description') { return this.description; }
        if (this.metadata.description) { return this.metadata.description; }

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
        if (!filePath) { return 'unknown'; }
        const parts = filePath.split(/[\\/]/);
        return parts[parts.length - 1];
    }

    public override dispose(): void {
        super.dispose(); // Disposes root mesh geometry/material

        // Recursively dispose children
        if (this.mesh && this.mesh.children) {
            this.mesh.children.forEach(child => {
                if (child instanceof THREE.Mesh) {
                    if (child.geometry) { child.geometry.dispose(); }
                    if (child.material) {
                        if (Array.isArray(child.material)) {
                            child.material.forEach(m => m.dispose());
                        } else {
                            child.material.dispose();
                        }
                    }
                }
            });
        }

        // Dispose label texture if present
        if (this.descriptionMesh) {
            if (this.descriptionMesh.material.map) {
                this.descriptionMesh.material.map.dispose();
            }
            this.descriptionMesh.material.dispose();
        }

        // Dispose warning badge
        if (this.warningBadge) {
            if (this.warningBadge.material.map) {
                this.warningBadge.material.map.dispose();
            }
            this.warningBadge.material.dispose();
        }
    }

    /**
     * Set or clear the warning badge on this file object
     */
    public setWarningBadge(warnings: ArchitectureWarning[] | null): void {
        // Clear existing badge
        if (this.warningBadge) {
            this.mesh.remove(this.warningBadge);
            if (this.warningBadge.material.map) {
                this.warningBadge.material.map.dispose();
            }
            this.warningBadge.material.dispose();
            this.warningBadge = null;
        }

        if (!warnings || warnings.length === 0) return;

        // Create warning badge
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d')!;

        // Determine color based on highest severity
        const hasHigh = warnings.some(w => w.severity === 'high');
        const hasMedium = warnings.some(w => w.severity === 'medium');
        const color = hasHigh ? '#ef4444' : hasMedium ? '#f97316' : '#eab308';

        // Draw badge circle
        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        // Draw count
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(warnings.length.toString(), 32, 32);

        // Create sprite
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);

        // Position in top-right corner of the file object
        const width = this.metadata.size?.width ?? 1;
        const height = this.metadata.size?.height ?? 1;
        sprite.scale.set(0.5, 0.5, 1);
        sprite.position.set(width / 2 + 0.1, height / 2 + 0.1, 0.2);

        this.warningBadge = sprite;
        this.mesh.add(sprite);
    }
}
