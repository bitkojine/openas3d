import * as THREE from 'three';
import { VisualObject } from './visual-object';
import { CodeEntityDTO } from '../types';
import { getLanguageColor } from '../../utils/languageRegistry';
import { createContentTexture, createTextSprite, createTextSpriteWithDeps, LabelDependencyStats, WrappedLine, CONTENT_CONFIG } from '../texture-factory';
import { ArchitectureWarning } from '../../core/analysis';
import { ThemeColors } from '../../shared/types';

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




    // State for re-rendering labels
    private sceneRef?: THREE.Scene;
    private currentStats?: LabelDependencyStats;
    private cachedLines?: WrappedLine[];




    protected createMesh(): THREE.Mesh {
        // Create geometry based on size in metadata or default
        const width = FileObject.STRICT_WIDTH;
        const bodyHeight = this.metadata.size?.height ?? 1;
        // Ignore cubic depth for visuals to achieve "smart display" look
        const HITBOX_DEPTH = 0.2;
        const FRAME_DEPTH = 0.1; // Very slim visual

        const capHeight = FileObject.BAR_HEIGHT;

        // 1. Root Mesh - Invisible HITBOX
        const rootGeometry = new THREE.BoxGeometry(width, bodyHeight, HITBOX_DEPTH);
        const rootMaterial = new THREE.MeshBasicMaterial({
            visible: false
        });
        const rootMesh = new THREE.Mesh(rootGeometry, rootMaterial);

        // 2. Frame Mesh - The structure (Smart Display Body)
        // Slightly larger in W/H, very thin
        const frameGeometry = new THREE.BoxGeometry(width + 0.1, bodyHeight + 0.1, FRAME_DEPTH);
        const frameTexture = this.createTechTexture(width + 0.1, bodyHeight + 0.1);
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
        const { texture: contentTexture, lines } = createContentTexture(content, undefined, undefined, width, bodyHeight);
        this.cachedLines = lines;
        const screenGeometry = new THREE.PlaneGeometry(width * 0.9, bodyHeight * 0.9);
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
        const barGeometry = new THREE.BoxGeometry(width + 0.1, capHeight, FRAME_DEPTH);
        const barTexture = this.createLanguageTexture(lang, color, width + 0.1, capHeight);
        const barMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map: barTexture,
            emissive: 0xffffff, // White emissive to let texture colors shine
            emissiveMap: barTexture, // Glow using the texture itself
            emissiveIntensity: 0.8 // High intensity for "sign" look
        });
        const barMesh = new THREE.Mesh(barGeometry, barMaterial);
        barMesh.position.y = (bodyHeight + 0.1) / 2 + capHeight / 2; // Sit exactly on top
        barMesh.position.z = 0.01; // Slight Z offset
        barMesh.userData.visualObject = this;
        rootMesh.add(barMesh);

        this._barMesh = barMesh;

        // 6. Bottom Cap (Filename)
        // Similar to top bar but at bottom
        const bottomCapGeometry = new THREE.BoxGeometry(width + 0.1, capHeight, FRAME_DEPTH);
        const filename = this.getFilename(this.filePath);
        // Use a neutral dark color for bottom cap unless themed
        const bottomCapTexture = this.createFilenameTexture(filename, 0x222222, width + 0.1, capHeight);
        const bottomCapMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            map: bottomCapTexture,
            emissive: 0xffffff,
            emissiveMap: bottomCapTexture,
            emissiveIntensity: 0.6
        });
        const bottomCapMesh = new THREE.Mesh(bottomCapGeometry, bottomCapMaterial);
        // Position at bottom: center is -(height + 0.1)/2 - barHeight/2
        bottomCapMesh.position.y = -((bodyHeight + 0.1) / 2 + capHeight / 2);
        bottomCapMesh.position.z = 0.01; // Slight Z offset
        bottomCapMesh.userData.visualObject = this;
        rootMesh.add(bottomCapMesh);
        this._bottomCapMesh = bottomCapMesh;

        rootMesh.castShadow = true;
        rootMesh.receiveShadow = true;

        return rootMesh;
    }

    private createTechTexture(width: number, height: number, theme?: ThemeColors): THREE.CanvasTexture {
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
            return new THREE.CanvasTexture(null as any);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.CanvasTexture(null as any);

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

        // Match aspect ratio logic from Bottom Cap to prevent stretching/squashing
        // Bar Height (World) = 0.6. Texture Height (Px) = 128.
        const idealResolution = canvasHeight / FileObject.BAR_HEIGHT; // px per unit
        const visiblePixels = width * idealResolution;

        // If the mesh is wider than the text needs, we clamp repeat to avoid tiling or stretching gap
        // Actually, for language cap we don't want RepeatWrapping usually (it's centered text).
        // But we DO want to avoid SQUASHING it if the mesh is narrow.

        // If mesh is NARROW (width < canvasWidth / idealResolution), repeatX > 1.
        // This effectively "zooms in" on the texture horizontally, or rather, maps a larger texture coords to the mesh.
        // texture.repeat.set(repeatX, 1) means the texture covers [0, repeatX] of the geometry.
        // If repeatX > 1, the texture is Tiled. We don't want tiling for centered text.
        // We want ClampToEdgeWrapping.

        // But if we simply map 0..1 to the mesh, and the mesh is square (1x1) but texture is 4:1 (512x128),
        // The texture apppears compressed 4x horizontally.

        // To fix aspect ratio on a SINGLE image (no tiling):
        // We usually scale the UVs or use a texture matrix.
        // Or we draw to the canvas with the correct aspect ratio for the mesh?
        // But mesh size varies dynamically.

        // BETTER APPROACH for fixed "Signage":
        // Always map the texture such that aspect ratio is preserved.
        // Setting texture.repeat.x = visiblePixels / canvasWidth is technically correct for TILING.
        // For Centered text:
        // If we want the text to look correct, we need the "viewport" of the texture to match the mesh aspect.
        // Mesh Aspect = width / 0.6.
        // Texture Aspect = canvasWidth / 128.

        // If Mesh Aspect < Texture Aspect (Mesh is taller/thinner relative to bar),
        // we show the full height, but only a fraction of width? No, we show full width.
        // This is tricky for "responsive" canvas mapping.

        // If we use the logic "pixels per unit", and set repeat.x:
        const repeatX = visiblePixels / canvasWidth;
        texture.repeat.set(repeatX, 1);

        // Center the content if we are zooming out (repeatX < 1)
        // offset = (1 - repeatX) / 2
        texture.offset.x = (1 - repeatX) / 2;

        // If repeatX > 1 (Mesh is wider than natural texture resolution), 
        // we tile (bad) or clamp (stretches edges).
        // If Mesh is wider, visiblePixels > canvasWidth.
        // If we want to avoid stretching, we should keep repeatX, but prevent tiling?
        // ClampToEdgeWrapping + repeatX > 1 -> The edge pixels are repeated.
        // This works perfectly if the edge pixels are background color!

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
            return new THREE.CanvasTexture(null as any);
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return new THREE.CanvasTexture(null as any);

        // 1. Setup Font
        const fontSize = 50;
        ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`;

        // 2. Measure Text Length
        // Add minimal padding for the loop gap
        const padding = "      ";
        const params = ctx.measureText(filename + padding);
        const textWidth = Math.ceil(params.width);

        // 3. Determine Canvas Dimensions
        // Height is fixed resolution for crispness (128px maps to 0.6 world units)
        const canvasHeight = 128;
        // Width must fit the text. Minimum 512 for short files, but grow if needed.
        // We use exactly textWidth (if larger than min) to make the loop seamless (wrapS).
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
        ctx.font = `bold ${fontSize}px "Segoe UI", Arial, sans-serif`; // Reset font after resize (canvas resize clears context state)

        // Left align to ensure we start at 0. Texture wrap will handle the loop.
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';

        // Vertically center
        ctx.fillText(filename + padding, 0, canvasHeight / 2);

        // 7. Create Texture
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;

        // 8. Calculate Repeat to Preserve Aspect Ratio
        // We want the text to look "true to size" (50px visual height relative to bar height).
        // Bar Height (World) = 0.6. Texture Height (Px) = 128.
        // Mesh Width (World) = width (passed arg). Texture Width (Px) = canvasWidth.

        // Visual Scale Factor = (Pixels / WorldUnit) Vertical
        // Vertical Resolution = 128 / 0.6 ~= 213 px/unit.

        // We want Horizontal Resolution to match (~213 px/unit).
        // Current Horizontal Resolution without repeat = canvasWidth / width.
        // If canvasWidth is huge (long text), resolution is huge -> squashed text.
        // We need to show a "window" of the texture such that the window width = width * 213 pixels.
        // Repeat = (Window Px) / (Total Px)
        // Repeat = (width * (128 / 0.6)) / canvasWidth

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
                // Scroll speed - Flipped direction (positive moves texture left, content right? No wait.
                // U offset += delta shifts texture coordinates right, so image moves LEFT.
                // User said "flowing in wrong direction". Previous was `-=`.
                // So let's try `+=`.
                mat.map.offset.x += 0.2 * deltaTime;
                if (mat.emissiveMap) mat.emissiveMap.offset.x = mat.map.offset.x;
            }
        }
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

    // State for cache invalidation
    private lastRenderedTheme?: string;
    private lastRenderedContent?: string;
    private lastRenderedFont?: string;

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

        // Update Bar (Language Cap)
        if (this._barMesh) {
            const mat = this._barMesh.material as THREE.MeshLambertMaterial;
            if (mat) {
                // Ensure the bar stays visible and vibrant but fits the lighting
                const isDark = new THREE.Color(theme.editorBackground).getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;
                // Boost intensity for dark mode to make it pop like a neon sign
                mat.emissiveIntensity = isDark ? 0.9 : 0.6;
            }
        }

        // Update Bottom Cap (Filename)
        if (this._bottomCapMesh) {
            const mat = this._bottomCapMesh.material as THREE.MeshLambertMaterial;
            if (mat) {
                if (mat.map) mat.map.dispose();
                if (mat.emissiveMap) mat.emissiveMap.dispose();

                const width = FileObject.STRICT_WIDTH;
                const filename = this.getFilename(this.filePath);
                const capHeight = FileObject.BAR_HEIGHT;
                const tex = this.createFilenameTexture(filename, 0x000000, width + 0.1, capHeight, theme);

                mat.map = tex;
                mat.emissiveMap = tex;
                mat.needsUpdate = true;

                // Match intensity with top bar or slightly less
                const isDark = new THREE.Color(theme.editorBackground).getHSL({ h: 0, s: 0, l: 0 }).l < 0.5;
                mat.emissiveIntensity = isDark ? 0.8 : 0.5;
            }
        }

        // Update Label
        if (this.sceneRef) {
            this.updateLabel(this.sceneRef, this.getDescriptionText(), this.currentStats, theme);
        }

        // Update Content Texture (Code Body)
        this.updateContentTexture(theme);

        // Update Frame Texture (Tech Body)
        // Check if theme colors relevant to frame have changed
        const newFrameKey = `${theme.activityBarBackground}-${theme.editorBackground}-${theme.selectionBackground}`;
        if (this._lastFrameThemeKey !== newFrameKey) {
            if (this._frameMesh) {
                const mat = this._frameMesh.material as THREE.MeshLambertMaterial;
                if (mat.map) mat.map.dispose();

                const width = FileObject.STRICT_WIDTH;
                const height = this.metadata.size?.height ?? 1;
                mat.map = this.createTechTexture(width + 0.1, height + 0.1, theme);
                mat.needsUpdate = true;
            }
            this._lastFrameThemeKey = newFrameKey;
        }
    }

    private _lastFrameThemeKey: string = '';

    private updateContentTexture(theme: ThemeColors): void {
        const screenFront = this.mesh.children.find(c => (c as THREE.Mesh).geometry && (c as THREE.Mesh).geometry.type === 'PlaneGeometry' && c.position.z > 0) as THREE.Mesh;
        if (!screenFront) return;

        const content = this.metadata.metadata?.content || '';

        // Check cache
        // We import CONTENT_CONFIG dynamically to check current state
        // (Assuming it's exported from texture-factory)
        const currentFont = JSON.stringify(CONTENT_CONFIG);
        const currentThemeStr = JSON.stringify(theme);

        if (this.lastRenderedContent === content &&
            this.lastRenderedTheme === currentThemeStr &&
            this.lastRenderedFont === currentFont) {
            return; // No changes needed
        }

        // Re-create texture with theme, reusing cached layout if available 
        // AND ONLY IF font/layout hasn't changed. If font changed, wrappedLines are invalid.
        if (this.lastRenderedFont !== currentFont) {
            this.cachedLines = undefined; // Force re-wrap
        }

        const width = FileObject.STRICT_WIDTH;
        const height = this.metadata.size?.height ?? 1;
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

        const height = this.metadata.size?.height ?? 1;
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

            const height = this.metadata.size?.height ?? 1;
            // FileObject has a bar on top, so top is higher than mesh bounds center
            // Bar sits at (height+0.1)/2 + capHeight/2
            // Top of bar is (height+0.1)/2 + capHeight
            const topOfCap = (height + 0.1) / 2 + FileObject.BAR_HEIGHT;
            const labelHeight = this.descriptionMesh.userData.height || 1;

            this.descriptionMesh.position.set(
                this.mesh.position.x,
                this.mesh.position.y + topOfCap + this.GAP + labelHeight / 2,
                this.mesh.position.z
            );
        }
    }

    private getDescriptionText(): string {
        if (this.description && this.description !== 'No description') { return this.description; }
        if (this.metadata.description) { return this.metadata.description; }

        // Fallback to metadata-based description
        if (this.metadata.metadata) {
            const meta = this.metadata.metadata;
            return [
                // Filename moved to bottom cap
                // Language is now visible on the object itself
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
        const width = FileObject.STRICT_WIDTH;
        const height = this.metadata.size?.height ?? 1;
        sprite.scale.set(0.5, 0.5, 1);
        sprite.position.set(width / 2 + 0.1, height / 2 + 0.1, 0.2);

        this.warningBadge = sprite;
        this.mesh.add(sprite);
    }
}
