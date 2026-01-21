import * as THREE from 'three';
import { CodeObject, DependencyEdge } from './types';
import { getLanguageColor } from '../utils/languageRegistry';

export class CodeObjectManager {
    private objects: Map<string, CodeObject> = new Map();
    private dependencies: Map<string, DependencyEdge> = new Map();
    private selectedObject: CodeObject | null = null;

    private readonly GROUND_Y = 0;
    private readonly GAP = 0.5;

    // languageColors moved to languageRegistry.ts

    constructor(private scene: THREE.Scene) { }

    private getFilename(filePath: string): string {
        const parts = filePath.split(/[\\/]/);
        return parts[parts.length - 1];
    }

    // Syntax highlighting color palette (VS Code dark theme inspired)
    private readonly syntaxColors = {
        background: '#1e1e1e',
        text: '#d4d4d4',
        keyword: '#569cd6',
        string: '#ce9178',
        comment: '#6a9955',
        number: '#b5cea8',
        function: '#dcdcaa',
        type: '#4ec9b0',
        lineNumber: '#858585',
        lineNumberBg: '#1e1e1e'
    };

    // Keywords for various languages
    private readonly keywords = new Set([
        // JavaScript/TypeScript
        'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
        'switch', 'case', 'break', 'continue', 'default', 'try', 'catch', 'finally', 'throw',
        'new', 'delete', 'typeof', 'instanceof', 'void', 'this', 'super', 'class', 'extends',
        'import', 'export', 'from', 'as', 'default', 'async', 'await', 'yield', 'static',
        'public', 'private', 'protected', 'readonly', 'abstract', 'interface', 'type', 'enum',
        'implements', 'namespace', 'module', 'declare', 'get', 'set', 'constructor',
        'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
        // Python
        'def', 'class', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally',
        'with', 'as', 'import', 'from', 'return', 'yield', 'raise', 'pass', 'break', 'continue',
        'and', 'or', 'not', 'in', 'is', 'lambda', 'global', 'nonlocal', 'True', 'False', 'None',
        // Common
        'int', 'float', 'double', 'string', 'boolean', 'bool', 'void', 'char', 'byte', 'long'
    ]);

    /**
     * Tokenize a line of code for syntax highlighting
     */
    private tokenizeLine(line: string): Array<{ text: string; color: string }> {
        const tokens: Array<{ text: string; color: string }> = [];
        let remaining = line;
        let inString: string | null = null;
        let inComment = false;

        while (remaining.length > 0) {
            // Check for line comment
            if (!inString && (remaining.startsWith('//') || remaining.startsWith('#'))) {
                tokens.push({ text: remaining, color: this.syntaxColors.comment });
                break;
            }

            // Check for string start/end
            if (!inComment) {
                const stringMatch = remaining.match(/^(['"`])/);
                if (stringMatch && !inString) {
                    inString = stringMatch[1];
                    // Find end of string
                    let endIdx = 1;
                    while (endIdx < remaining.length) {
                        if (remaining[endIdx] === inString && remaining[endIdx - 1] !== '\\') {
                            endIdx++;
                            break;
                        }
                        endIdx++;
                    }
                    tokens.push({ text: remaining.slice(0, endIdx), color: this.syntaxColors.string });
                    remaining = remaining.slice(endIdx);
                    inString = null;
                    continue;
                }
            }

            // Check for numbers
            const numberMatch = remaining.match(/^(\d+\.?\d*)/);
            if (numberMatch && (tokens.length === 0 || /\W$/.test(tokens[tokens.length - 1]?.text || ''))) {
                tokens.push({ text: numberMatch[1], color: this.syntaxColors.number });
                remaining = remaining.slice(numberMatch[1].length);
                continue;
            }

            // Check for keywords and identifiers
            const wordMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
            if (wordMatch) {
                const word = wordMatch[1];
                if (this.keywords.has(word)) {
                    tokens.push({ text: word, color: this.syntaxColors.keyword });
                } else if (remaining.slice(word.length).match(/^\s*\(/)) {
                    // Followed by ( - likely a function call
                    tokens.push({ text: word, color: this.syntaxColors.function });
                } else if (word[0] === word[0].toUpperCase() && word.length > 1) {
                    // PascalCase - likely a type
                    tokens.push({ text: word, color: this.syntaxColors.type });
                } else {
                    tokens.push({ text: word, color: this.syntaxColors.text });
                }
                remaining = remaining.slice(word.length);
                continue;
            }

            // Default: single character
            tokens.push({ text: remaining[0], color: this.syntaxColors.text });
            remaining = remaining.slice(1);
        }

        return tokens;
    }

    /**
     * Create a content minimap texture with syntax highlighting and line numbers
     */
    private createContentTexture(fileContent: string, boxWidth: number, boxHeight: number, language?: string): THREE.Texture {
        const maxLines = 150;
        const lines = fileContent.split('\n').slice(0, maxLines);

        // Higher resolution for better quality
        const padding = 12;
        const fontSize = 14;
        const lineHeight = fontSize * 1.4;
        const lineNumberWidth = 45; // Space for line numbers

        const canvasWidth = 1024;
        const canvasHeight = Math.max(256, Math.min(1024, padding * 2 + lines.length * lineHeight));

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d')!;

        // Enable better text rendering
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Dark background
        ctx.fillStyle = this.syntaxColors.background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Line number background (slightly different shade)
        ctx.fillStyle = '#252526';
        ctx.fillRect(0, 0, lineNumberWidth, canvas.height);

        // Use a good monospace font
        ctx.font = `${fontSize}px "Consolas", "Monaco", "Courier New", monospace`;
        ctx.textBaseline = 'top';

        let y = padding;
        lines.forEach((line, idx) => {
            const lineNum = idx + 1;

            // Draw line number
            ctx.fillStyle = this.syntaxColors.lineNumber;
            ctx.textAlign = 'right';
            ctx.fillText(String(lineNum), lineNumberWidth - 8, y);

            // Draw code with syntax highlighting
            ctx.textAlign = 'left';
            let x = lineNumberWidth + 8;

            const tokens = this.tokenizeLine(line.slice(0, 120)); // Limit line length
            for (const token of tokens) {
                ctx.fillStyle = token.color;
                ctx.fillText(token.text, x, y);
                x += ctx.measureText(token.text).width;
            }

            y += lineHeight;
        });

        // Add fade at bottom if content is truncated
        if (lines.length >= maxLines) {
            const gradient = ctx.createLinearGradient(0, canvasHeight - 40, 0, canvasHeight);
            gradient.addColorStop(0, 'rgba(30, 30, 30, 0)');
            gradient.addColorStop(1, 'rgba(30, 30, 30, 1)');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, canvasHeight - 40, canvasWidth, 40);

            // "..." indicator
            ctx.fillStyle = this.syntaxColors.lineNumber;
            ctx.textAlign = 'center';
            ctx.fillText('...', canvasWidth / 2, canvasHeight - 20);
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.anisotropy = 4; // Better quality at angles

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
            const width = data.size?.width ?? 1;
            const height = data.size?.height ?? 1;
            const depth = data.size?.depth ?? 1;

            geometry = new THREE.BoxGeometry(width, height, depth);

            // Create minimap texture using method like labels
            const content = data.metadata?.content || '';
            const lang = data.metadata?.language?.toLowerCase() || 'other';
            const contentTexture = this.createContentTexture(content, width, height, lang);
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

        // Position Y so bottom is GAP above ground
        mesh.geometry.computeBoundingBox();
        const meshHeight = mesh.geometry.boundingBox
            ? mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y
            : data.type === 'sign' ? 1.0 : 1;

        mesh.position.set(
            data.position.x,
            this.GROUND_Y + this.GAP + meshHeight / 2,
            data.position.z
        );

        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        // Create description sprite above the box
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

        const descriptionStatus = data.descriptionStatus || 'missing';
        const descriptionLastUpdated = data.descriptionLastUpdated || new Date().toISOString();

        const descriptionSprite = this.createTextSprite(descriptionText || 'No description');

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
        const meshHeight = mesh.geometry.boundingBox
            ? mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y
            : obj.type === 'sign' ? 1.0 : 1;

        const labelHeight = newSprite.userData.height || 1;
        newSprite.position.set(
            obj.position.x,
            mesh.position.y + meshHeight / 2 + this.GAP + labelHeight / 2,
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

        const points = [
            sourceObj.mesh.position.clone(),
            targetObj.mesh.position.clone()
        ];

        const dir = targetObj.mesh.position.clone().sub(sourceObj.mesh.position).normalize();
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


    private setEmissiveColor(obj: CodeObject, colorHex: number): void {
        const materials = Array.isArray(obj.mesh.material) ? obj.mesh.material : [obj.mesh.material];
        materials.forEach(mat => {
            if ((mat as THREE.MeshLambertMaterial).emissive) {
                (mat as THREE.MeshLambertMaterial).emissive.setHex(colorHex);
            }
        });
    }

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
        // If same object, do nothing
        if (this.selectedObject === obj) return;

        // Clear previous selection/glow
        if (this.selectedObject) {
            this.setEmissiveColor(this.selectedObject, 0x000000);
        }

        this.selectedObject = obj;

        // Apply new glow
        if (this.selectedObject) {
            this.setEmissiveColor(this.selectedObject, 0xaaaaaa); // Stronger glow for focus
        }
    }

    public findByMesh(mesh: THREE.Mesh): CodeObject | undefined {
        return [...this.objects.values()].find(o => o.mesh === mesh);
    }

    public getObjectMeshes(): THREE.Object3D[] {
        return [...this.objects.values()].map(o => o.mesh);
    }

    public updateDescriptions(camera: THREE.Camera): void {
        this.objects.forEach(obj => {
            if (obj.descriptionMesh) {
                obj.descriptionMesh.lookAt(camera.position);

                const mesh = obj.mesh;
                mesh.geometry.computeBoundingBox();
                const meshHeight = mesh.geometry.boundingBox
                    ? mesh.geometry.boundingBox.max.y - mesh.geometry.boundingBox.min.y
                    : obj.type === 'sign' ? 1.0 : 1;

                const labelHeight = obj.descriptionMesh.userData.height || 1;

                obj.descriptionMesh.position.set(
                    obj.position.x,
                    mesh.position.y + meshHeight / 2 + this.GAP + labelHeight / 2,
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
