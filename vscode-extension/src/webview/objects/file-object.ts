import * as THREE from 'three';
import { VisualObject } from './visual-object';
import { RenderableEntity } from '../types';
import { CodeEntityDTO, FileEntityDTO } from '../../shared/types';
import { getLanguageColor } from '../../utils/languageRegistry';
import { createContentTexture, createTextSprite, createTextSpriteWithDeps, LabelDependencyStats, WrappedLine, CONTENT_CONFIG } from '../texture-factory';
import { ArchitectureWarning } from '../../core/analysis';
import { ThemeColors } from '../../shared/types';

interface FileMetadata {
    height?: number;
    content?: string;
    language?: string;
    isLibrary?: boolean;
    filePath?: string;
    size?: { height?: number };
    complexity?: number;
    lastModified?: string;
    color?: number;
}

export class FileObject extends VisualObject {
    // Configurable gap between box and label
    private readonly GAP = 0.4; // Reduced as requested
    private static readonly BAR_HEIGHT = 0.4; // STRICT FIXED HEIGHT for caps
    private static readonly STRICT_WIDTH = 1.5; // FIXED WIDTH for all file objects
    private warningBadge: THREE.Sprite | null = null;

    // Mesh References
    private _frameMesh?: THREE.Mesh;
    private _barMesh?: THREE.Mesh;
    private _bottomCapMesh?: THREE.Mesh;
    private _screenBack?: THREE.Mesh;
    private _statusBeam?: THREE.Object3D;
    private _testStatus: 'passed' | 'failed' | 'running' | 'unknown' = 'unknown';

    // Interaction State
    private _isFocused = false;
    private _isSelected = false;

    private sceneRef?: THREE.Scene;
    private currentStats?: LabelDependencyStats;
    private cachedLines?: WrappedLine[];

    protected createMesh(): THREE.Mesh {
        const metadata = this.metadata as FileMetadata;
        const bodyHeight = metadata.size?.height ?? 1;
        const width = FileObject.STRICT_WIDTH;
        const HITBOX_DEPTH = 0.2;

        // 1. Root Hitbox (Invisible)
        const rootGeometry = new THREE.BoxGeometry(width, bodyHeight, HITBOX_DEPTH);
        const rootMaterial = new THREE.MeshBasicMaterial({ visible: false });
        const rootMesh = new THREE.Mesh(rootGeometry, rootMaterial);

        // 2. Build Components
        this.addFrame(rootMesh, width, bodyHeight);
        this.addScreens(rootMesh, width, bodyHeight);
        this.addCaps(rootMesh, width, bodyHeight);

        rootMesh.castShadow = true;
        rootMesh.receiveShadow = true;
        return rootMesh;
    }

    private addFrame(root: THREE.Mesh, width: number, height: number): void {
        const FRAME_DEPTH = 0.1;
        const frameGeometry = new THREE.BoxGeometry(width + 0.1, height + 0.1, FRAME_DEPTH);
        const frameTexture = this.createTechTexture(width + 0.1, height + 0.1);
        const frameMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            emissive: 0x111111,
            map: frameTexture
        });

        this._frameMesh = new THREE.Mesh(frameGeometry, frameMaterial);
        this._frameMesh.castShadow = true;
        this._frameMesh.receiveShadow = true;
        this._frameMesh.userData.visualObject = this;
        root.add(this._frameMesh);
    }

    private addScreens(root: THREE.Mesh, width: number, height: number): void {
        const FRAME_DEPTH = 0.1;
        const metadata = this.metadata as FileMetadata;
        const content = metadata.content || '';
        const { texture: contentTexture, lines } = createContentTexture(content, undefined, undefined, width, height);
        this.cachedLines = lines;

        const screenGeometry = new THREE.PlaneGeometry(width * 0.9, height * 0.9);
        const screenMaterial = new THREE.MeshBasicMaterial({
            map: contentTexture,
            side: THREE.FrontSide,
            fog: false,
            toneMapped: false
        });

        // Front Screen
        const screenFront = new THREE.Mesh(screenGeometry, screenMaterial);
        screenFront.position.z = FRAME_DEPTH / 2 + 0.01;
        screenFront.userData.visualObject = this;
        root.add(screenFront);

        // Back Screen
        this._screenBack = new THREE.Mesh(screenGeometry, screenMaterial);
        this._screenBack.rotation.y = Math.PI;
        this._screenBack.position.z = -(FRAME_DEPTH / 2 + 0.01);
        this._screenBack.userData.visualObject = this;
        root.add(this._screenBack);
    }

    private addCaps(root: THREE.Mesh, width: number, height: number): void {
        const capHeight = FileObject.BAR_HEIGHT;
        const FRAME_DEPTH = 0.1;
        const metadata = this.metadata as FileMetadata;

        // Top Bar (Language)
        const lang = metadata.language?.toLowerCase() || 'other';
        const color = metadata.color ?? getLanguageColor(lang);
        const barGeometry = new THREE.BoxGeometry(width + 0.1, capHeight, FRAME_DEPTH);
        const barTexture = this.createLanguageTexture(lang, color, width + 0.1, capHeight);
        const barMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map: barTexture,
            emissive: 0xffffff,
            emissiveMap: barTexture,
            emissiveIntensity: 0.8
        });

        this._barMesh = new THREE.Mesh(barGeometry, barMaterial);
        this._barMesh.position.y = (height + 0.1) / 2 + capHeight / 2;
        this._barMesh.position.z = 0.01;
        this._barMesh.userData.visualObject = this;
        root.add(this._barMesh);

        // Bottom Bar (Filename)
        const filename = this.getFilename(this.filePath);
        const bottomTexture = this.createFilenameTexture(filename, 0x222222, width + 0.1, capHeight);
        const bottomMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map: bottomTexture,
            emissive: 0xffffff,
            emissiveMap: bottomTexture,
            emissiveIntensity: 0.6
        });

        this._bottomCapMesh = new THREE.Mesh(barGeometry, bottomMaterial); // Reuse barGeometry size
        this._bottomCapMesh.position.y = -((height + 0.1) / 2 + capHeight / 2);
        this._bottomCapMesh.position.z = 0.01;
        this._bottomCapMesh.userData.visualObject = this;
        root.add(this._bottomCapMesh);
    }

    private createTechTexture(width: number, height: number, theme?: ThemeColors): THREE.CanvasTexture {
        let canvas: HTMLCanvasElement;

        // Handle environment (Node vs Browser)
        if (typeof document !== 'undefined' && document.createElement) {
            canvas = document.createElement('canvas');
        } else {
            // For Node environment (tests), return a dummy texture
            return new THREE.CanvasTexture({} as unknown as HTMLCanvasElement);
        }

        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        if (ctx) {
            // Background
            ctx.fillStyle = theme?.activityBarBackground || '#222222';
            ctx.fillRect(0, 0, 512, 512);

            // Grid lines
            ctx.strokeStyle = theme?.editorBackground || '#333333';
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
            const detailsColor = theme
                ? '#' + new THREE.Color(theme.activityBarBackground).offsetHSL(0, 0, -0.2).getHexString()
                : '#1a1a1a';
            ctx.fillStyle = detailsColor;
            for (let i = 0; i < 20; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                const w = Math.random() * 100 + 20;
                const h = Math.random() * 50 + 10;
                ctx.fillRect(x, y, w, h);
            }

            // Emissive accents (subtle)
            ctx.fillStyle = theme?.selectionBackground || '#334455';
            for (let i = 0; i < 10; i++) {
                const x = Math.random() * 512;
                const y = Math.random() * 512;
                ctx.fillRect(x, y, 10, 10);
            }
        }

        return new THREE.CanvasTexture(canvas);
    }

    private createLanguageTexture(language: string, colorHex: number, width: number, height: number): THREE.CanvasTexture {
        let canvas: HTMLCanvasElement;
        if (typeof document !== 'undefined' && document.createElement) {
            canvas = document.createElement('canvas');
        } else {
            return new THREE.CanvasTexture({} as unknown as HTMLCanvasElement);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.CanvasTexture({} as unknown as HTMLCanvasElement);

        // 1. Setup Font to measure text
        ctx.font = 'bold 70px "Segoe UI", Arial, sans-serif';

        let text = language.toUpperCase();
        if (text === 'OTHER' || !text) {
            // Extract extension or filename
            const parts = this.filePath.split(/[\\/]/);
            const filename = parts[parts.length - 1];
            const lastDotIndex = filename.lastIndexOf('.');

            if (lastDotIndex > 0) {
                text = '.' + filename.substring(lastDotIndex + 1).toUpperCase();
            } else {
                text = filename.toUpperCase();
            }
        }

        // 2. Measure Text Length and Calculate Canvas Size
        const padding = "   "; // Small padding
        const params = ctx.measureText(text + padding);
        const textWidth = Math.ceil(params.width);

        const canvasHeight = 128;
        // Ensure minimum 512, but grow if text is wider
        const canvasWidth = Math.max(512, textWidth);

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // 3. Draw Background
        // Recalculate color if context was reset by resize
        let colorStyle = '#000000';
        let luminance = 0;
        try {
            const color = new THREE.Color(colorHex);
            const r = Math.floor(color.r * 255);
            const g = Math.floor(color.g * 255);
            const b = Math.floor(color.b * 255);
            colorStyle = `rgb(${r},${g},${b})`;
            luminance = 0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b;
        } catch (e) {
            colorStyle = '#' + (colorHex.toString(16).padStart(6, '0'));
        }

        ctx.fillStyle = colorStyle;
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 4. Draw Text
        const textColor = luminance > 0.5 ? '#000000' : '#ffffff';
        const strokeColor = luminance > 0.5 ? '#ffffff' : '#000000';

        ctx.fillStyle = textColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 4;

        // Reset font after resize
        ctx.font = 'bold 70px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw centered relative to canvas width
        ctx.strokeText(text, canvasWidth / 2, canvasHeight / 2);
        ctx.fillText(text, canvasWidth / 2, canvasHeight / 2);

        // 5. Create Texture with Aspect Ratio Fix
        const texture = new THREE.CanvasTexture(canvas);

        const idealResolution = canvasHeight / FileObject.BAR_HEIGHT; // px per unit
        const visiblePixels = width * idealResolution;

        const repeatX = visiblePixels / canvasWidth;
        texture.repeat.set(repeatX, 1);

        // Center the content if we are zooming out (repeatX < 1)
        texture.offset.x = (1 - repeatX) / 2;

        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        return texture;
    }

    private createFilenameTexture(filename: string, colorHex: number, width: number, height: number, theme?: ThemeColors): THREE.CanvasTexture {
        let canvas: HTMLCanvasElement;
        // Handle environment (Node vs Browser)
        if (typeof document !== 'undefined' && document.createElement) {
            canvas = document.createElement('canvas');
        } else {
            return new THREE.CanvasTexture({} as unknown as HTMLCanvasElement);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.CanvasTexture({} as unknown as HTMLCanvasElement);

        // 1. Setup Font
        const fontSize = 50;
        ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;

        // 2. Measure Text Length
        const padding = "      ";
        const params = ctx.measureText(filename + padding);
        const textWidth = Math.ceil(params.width);

        // 3. Determine Canvas Dimensions
        const canvasHeight = 128;
        const canvasWidth = Math.max(512, textWidth);

        canvas.width = canvasWidth;
        canvas.height = canvasHeight;

        // 4. Draw Background
        if (theme && theme.statusBarBackground) {
            ctx.fillStyle = theme.statusBarBackground;
        } else {
            ctx.fillStyle = '#222222';
        }
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);

        // 5. Draw Borders (Top/Bottom only)
        ctx.lineWidth = 4;
        ctx.strokeStyle = theme ? theme.editorForeground || '#333333' : '#333333';

        ctx.beginPath();
        ctx.moveTo(0, 0); // Top line
        ctx.lineTo(canvasWidth, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, canvasHeight); // Bottom line
        ctx.lineTo(canvasWidth, canvasHeight);
        ctx.stroke();

        // 6. Draw Text
        ctx.fillStyle = theme ? theme.editorForeground || '#ffffff' : '#ffffff';
        ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;

        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Vertically center
        ctx.fillText(filename + padding, 0, canvasHeight / 2);

        // 7. Create Texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // 8. Calculate Repeat to Preserve Aspect Ratio
        const idealResolution = canvasHeight / FileObject.BAR_HEIGHT; // px per unit
        const visiblePixels = width * idealResolution;
        const repeatX = visiblePixels / canvasWidth;

        texture.repeat.set(repeatX, 1);

        return texture;
    }

    public override animate(time: number, deltaTime: number): void {
        super.animate(time, deltaTime);

        // Scroll the bottom cap texture (Marquee)
        if (this._bottomCapMesh) {
            const mat = this._bottomCapMesh.material as THREE.MeshLambertMaterial;
            if (mat && mat.map) {
                mat.map.offset.x += 0.2 * deltaTime;
                if (mat.emissiveMap) mat.emissiveMap.offset.x = mat.map.offset.x;
            }
        }

        // TDD Failure Pulse
        if (this._testStatus === 'failed') {
            const pulse = 0.5 + 0.5 * Math.sin(time * 5); // 0.5 to 1.0 glow
            this.setEmissiveIntensity(pulse);
        } else if (this._testStatus === 'running') {
            const pulse = 0.3 + 0.2 * Math.sin(time * 8); // Rapid subtle pulse
            this.setEmissiveIntensity(pulse);
        }
    }

    private setEmissiveIntensity(intensity: number): void {
        const materials = [
            this._frameMesh?.material,
            this._barMesh?.material,
            this._bottomCapMesh?.material
        ].filter(Boolean) as THREE.MeshLambertMaterial[];

        materials.forEach(mat => {
            mat.emissiveIntensity = intensity;
        });
    }

    /** Post-creation initialization to add label. */
    public initializeLabel(scene: THREE.Scene): void {
        this.sceneRef = scene;
        this.updateLabel(scene, this.getDescriptionText());
    }

    public update(data: Record<string, unknown>): void {
        this.metadata = { ...this.metadata, ...data };
        if (data.filePath) { this.filePath = data.filePath as string; }
    }

    public updateTheme(theme: ThemeColors): void {
        const isDark = new THREE.Color(theme.editorBackground).getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;

        // Update Frame
        if (this._frameMesh) {
            const mat = this._frameMesh.material as THREE.MeshLambertMaterial;
            if (mat?.emissive) {
                const color = new THREE.Color(theme.editorBackground);
                if (color.getHSL({ h: 0, s: 0, l: 0 }).l < 0.1) color.offsetHSL(0, 0, 0.1);
                mat.emissive.copy(color.multiplyScalar(0.2));
            }
        }

        // Update Bar (Language Cap)
        if (this._barMesh) {
            const mat = this._barMesh.material as THREE.MeshLambertMaterial;
            if (mat) mat.emissiveIntensity = isDark ? 0.9 : 0.6;
        }

        // Update Bottom Cap (Filename)
        if (this._bottomCapMesh) {
            const mat = this._bottomCapMesh.material as THREE.MeshLambertMaterial;
            if (mat) {
                if (mat.map) mat.map.dispose();
                if (mat.emissiveMap) mat.emissiveMap.dispose();

                const width = FileObject.STRICT_WIDTH;
                const filename = this.getFilename(this.filePath);
                const tex = this.createFilenameTexture(filename, 0x000000, width + 0.1, FileObject.BAR_HEIGHT, theme);

                mat.map = tex;
                mat.emissiveMap = tex;
                mat.emissiveIntensity = isDark ? 0.8 : 0.5;
                mat.needsUpdate = true;
            }
        }

        // Update Label
        if (this.sceneRef) {
            this.updateLabel(this.sceneRef, this.getDescriptionText(), this.currentStats, theme);
        }

        // Update Content Texture (Code Body)
        this.updateContentTexture(theme);

        // Update Frame Texture (Tech Body)
        const newFrameKey = `${theme.activityBarBackground}-${theme.editorBackground}-${theme.selectionBackground}`;
        if (this._lastFrameThemeKey !== newFrameKey) {
            if (this._frameMesh) {
                const mat = this._frameMesh.material as THREE.MeshLambertMaterial;
                const metadata = this.metadata as FileMetadata;
                if (mat.map) mat.map.dispose();
                mat.map = this.createTechTexture(FileObject.STRICT_WIDTH + 0.1, (metadata.size?.height ?? 1) + 0.1, theme);
                mat.needsUpdate = true;
            }
            this._lastFrameThemeKey = newFrameKey;
        }
    }

    private _lastFrameThemeKey: string = '';
    private lastRenderedTheme?: string;
    private lastRenderedContent?: string;
    private lastRenderedFont?: string;

    private updateContentTexture(theme: ThemeColors): void {
        const screenFront = this.mesh.children.find(c => (c as THREE.Mesh).geometry && (c as THREE.Mesh).geometry.type === 'PlaneGeometry' && c.position.z > 0) as THREE.Mesh;
        if (!screenFront) return;

        const metadata = this.metadata as FileMetadata;
        const content = metadata.content || '';

        // Check cache
        const currentFont = JSON.stringify(CONTENT_CONFIG);
        const currentThemeStr = JSON.stringify(theme);

        if (this.lastRenderedContent === content &&
            this.lastRenderedTheme === currentThemeStr &&
            this.lastRenderedFont === currentFont) {
            return; // No changes needed
        }

        if (this.lastRenderedFont !== currentFont) {
            this.cachedLines = undefined; // Force re-wrap
        }

        const width = FileObject.STRICT_WIDTH;
        const height = metadata.size?.height ?? 1;
        const { texture: newTexture, lines } = createContentTexture(content, theme, this.cachedLines, width, height);
        this.cachedLines = lines;

        // Update cache state
        this.lastRenderedContent = content;
        this.lastRenderedTheme = currentThemeStr;
        this.lastRenderedFont = currentFont;

        // Dispose old texture
        const oldMat = screenFront.material as THREE.MeshBasicMaterial;
        if (oldMat.map) oldMat.map.dispose();

        // Update material
        oldMat.map = newTexture;
        oldMat.needsUpdate = true;

        // Also update back screen if we want (it matches front currently)
        if (this._screenBack) {
            const backMat = this._screenBack.material as THREE.MeshBasicMaterial;
            backMat.map = newTexture; // Share texture
            backMat.needsUpdate = true;
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

        const metadata = this.metadata as FileMetadata;
        const height = metadata.size?.height ?? 1;
        const capHeight = FileObject.BAR_HEIGHT;
        const topOfCap = (height + 0.1) / 2 + capHeight;
        const labelHeight = sprite.userData.height || 1;

        sprite.position.set(
            this.position.x,
            this.position.y + topOfCap + this.GAP + labelHeight / 2,
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

    public override updateLabelPosition(camera: THREE.Camera): void {
        if (this.descriptionMesh) {
            this.descriptionMesh.lookAt(camera.position);

            const metadata = this.metadata as FileMetadata;
            const height = metadata.size?.height ?? 1;
            const topOfCap = (height + 0.1) / 2 + FileObject.BAR_HEIGHT;
            const labelHeight = this.descriptionMesh.userData.height || 1;

            this.descriptionMesh.position.set(
                this.mesh.position.x,
                this.mesh.position.y + topOfCap + this.GAP + labelHeight / 2,
                this.mesh.position.z
            );
        }
    }

    // Interaction Overrides to preserve Test Color
    public override select(): void {
        this._isSelected = true;
        this.updateEmissiveColor();
    }

    public override deselect(): void {
        this._isSelected = false;
        this.updateEmissiveColor();
    }

    public override setInteractionState(start: boolean): void {
        this._isFocused = start;
        this.updateEmissiveColor();
    }

    private updateEmissiveColor(): void {
        if (this._testStatus === 'failed') {
            this.setEmissive(0xff0000); // Priority 1: Failing
        } else if (this._testStatus === 'running') {
            this.setEmissive(0xffaa00); // Priority 2: Running (Orange/Yellow)
        } else if (this._testStatus === 'passed') {
            this.setEmissive(0x00ff00); // Priority 3: Passed
        } else if (this._isSelected) {
            this.setEmissive(0x444444); // Selection highlight
        } else if (this._isFocused) {
            this.setEmissive(0x222222); // Focus/Hover
        } else {
            this.setEmissive(0x000000); // Normal
        }
    }

    private getDescriptionText(): string {
        if (this.description && this.description !== 'No description') { return this.description; }

        const metadata = this.metadata as FileMetadata;
        return [
            // Filename moved to bottom cap
            // Language is now visible on the object itself
            `Size: ${(metadata.size?.height ?? 0).toLocaleString('lt-LT')} bytes`,
            `Complexity: ${metadata.complexity ?? 'N/A'}`,
            `Last Modified: ${metadata.lastModified ? new Date(metadata.lastModified).toLocaleDateString('lt-LT', { timeZone: 'Europe/Vilnius' }) : 'unknown'}`
        ].join('\n');
    }

    private getFilename(filePath: string): string {
        if (!filePath) { return 'unknown'; }
        const parts = filePath.split(/[\\/]/);
        return parts[parts.length - 1];
    }

    public override dispose(): void {
        super.dispose();

        // 1. Recursive child disposal
        if (this.mesh?.children) {
            [...this.mesh.children].forEach(child => this.disposeObject(child));
        }

        // 2. Specialized assets
        if (this.descriptionMesh) this.disposeObject(this.descriptionMesh);
        if (this.warningBadge) this.disposeObject(this.warningBadge);
    }

    private disposeObject(obj: THREE.Object3D): void {
        if (!obj) return;

        // Remove from parent if still attached
        if (obj.parent) obj.parent.remove(obj);

        // Recursive disposal for Groups/Meshes
        if (obj.children.length > 0) {
            [...obj.children].forEach(child => this.disposeObject(child));
        }

        if (obj instanceof THREE.Mesh || obj instanceof THREE.Sprite) {
            obj.geometry?.dispose();
            if (Array.isArray(obj.material)) {
                obj.material.forEach(m => {
                    m.map?.dispose();
                    m.dispose();
                });
            } else if (obj.material) {
                obj.material.map?.dispose();
                obj.material.dispose();
            }
        }
    }

    /** Set or clear the architecture warning badge. */
    public setWarningBadge(warnings: ArchitectureWarning[] | null): void {
        if (this.warningBadge) {
            this.disposeObject(this.warningBadge);
            this.warningBadge = null;
        }

        if (!warnings || warnings.length === 0) return;

        const canvas = (typeof document !== 'undefined' && document.createElement) ? document.createElement('canvas') : null;
        if (!canvas) { return; }
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) { return; }

        const hasHigh = warnings.some(w => w.severity === 'high');
        const hasMedium = warnings.some(w => w.severity === 'medium');
        const color = hasHigh ? '#ef4444' : hasMedium ? '#f97316' : '#eab308';

        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(warnings.length.toString(), 32, 32);

        const material = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true });
        this.warningBadge = new THREE.Sprite(material);

        const metadata = this.metadata as FileMetadata;
        const height = metadata.size?.height ?? 1;
        this.warningBadge.scale.set(0.5, 0.5, 1);
        this.warningBadge.position.set(FileObject.STRICT_WIDTH / 2 + 0.1, height / 2 + 0.1, 0.2);

        this.mesh.add(this.warningBadge);
    }

    /** Set test status visualization. */
    public setTestStatus(status: 'passed' | 'failed' | 'running' | 'unknown'): void {
        if (this._testStatus === status) return;
        this._testStatus = status;

        if (this._statusBeam) {
            this.disposeObject(this._statusBeam);
            this._statusBeam = undefined;
        }

        if (this.warningBadge) {
            this.disposeObject(this.warningBadge);
            this.warningBadge = null;
        }

        this.updateEmissiveColor();

        if (status === 'failed') {
            this.createStatusBeam(0xff0000);
        } else if (status === 'passed') {
            this.setEmissiveIntensity(0.5);
            this.createStatusBeam(0x00ff00);
        } else if (status === 'unknown') {
            this.setEmissiveIntensity(0.2);
        }

        if (status !== 'unknown' && status !== 'failed' && status !== 'passed') {
            this.createTestBadge(status as 'passed' | 'running');
        }
    }

    private createStatusBeam(color: number): void {
        const beamHeight = 500;
        const container = new THREE.Group();

        // 1. Inner Core (Highly saturated)
        const coreGeometry = new THREE.CylinderGeometry(0.04, 0.08, beamHeight, 8, 1, true);
        const coreMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide
        });
        const core = new THREE.Mesh(coreGeometry, coreMaterial);
        container.add(core);

        // 2. Outer Glow (Soft emission)
        const glowGeometry = new THREE.CylinderGeometry(0.1, 0.5, beamHeight, 8, 1, true);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: color,
            transparent: true,
            opacity: 0.3,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        container.add(glow);

        // Position at top of object, extending upwards
        const metadata = this.metadata as FileMetadata;
        const bodyHeight = metadata.size?.height ?? 1;
        const capHeight = FileObject.BAR_HEIGHT;
        const topOfCap = (bodyHeight + 0.1) / 2 + capHeight;

        container.position.y = topOfCap + beamHeight / 2;
        container.userData.visualObject = this;

        this.mesh.add(container);
        this._statusBeam = container; // Store for disposal
    }

    private createTestBadge(status: 'passed' | 'running'): void {
        const canvas = (typeof document !== 'undefined' && document.createElement) ? document.createElement('canvas') : null;
        if (!canvas) { return; }
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (!ctx) { return; }

        const color = status === 'passed' ? '#22c55e' : '#eab308';
        const symbol = status === 'passed' ? '✓' : '●';

        ctx.beginPath();
        ctx.arc(32, 32, 28, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(symbol, 32, 32);

        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
        const sprite = new THREE.Sprite(material);

        const width = FileObject.STRICT_WIDTH;
        const metadata = this.metadata as FileMetadata;
        const height = metadata.size?.height ?? 1;
        sprite.scale.set(0.5, 0.5, 1);
        sprite.position.set(width / 2 + 0.2, height / 2 + 0.2, 0.3);

        this.warningBadge = sprite;
        this.mesh.add(sprite);
    }

    public toDTO(): FileEntityDTO {
        return {
            id: this.id,
            type: this.type as 'file' | 'module' | 'class' | 'function',
            position: { x: this.position.x, y: this.position.y, z: this.position.z },
            filePath: this.filePath,
            metadata: {
                ...this.metadata,
                description: this.description,
                descriptionStatus: this.descriptionStatus,
                descriptionLastUpdated: this.descriptionLastUpdated
            }
        };
    }
}
