/**
 * Environment Visual Systems
 * 
 * Provides immersive environment features for the 3D code park:
 * - Procedural sky with gradient and sun
 * - Animated cloud system
 * - Distant terrain with biomes and hills
 */
import * as THREE from 'three';
import { ThemeColors } from '../shared/types';

// ============================================================================
// PROCEDURAL SKY
// ============================================================================

/**
 * Creates a procedural sky dome with gradient colors and a visible sun
 */
export class ProceduralSky {
    public readonly mesh: THREE.Mesh;
    public readonly sunPosition: THREE.Vector3;

    constructor() {
        this.sunPosition = new THREE.Vector3(200, 150, 100).normalize();
        this.mesh = this.createSkyDome();
    }

    private createSkyDome(): THREE.Mesh {
        // Large sphere for sky - camera is inside looking out
        const geometry = new THREE.SphereGeometry(800, 64, 32);

        // Custom shader for gradient sky
        const material = new THREE.ShaderMaterial({
            uniforms: {
                sunDirection: { value: this.sunPosition },
                topColor: { value: new THREE.Color(0x1e90ff) },     // Bright blue zenith
                horizonColor: { value: new THREE.Color(0x87ceeb) }, // Light sky blue horizon
                groundColor: { value: new THREE.Color(0x7ab87a) },  // Green-ish below horizon
                sunColor: { value: new THREE.Color(0xfffff0) },     // Warm white sun
                sunGlowColor: { value: new THREE.Color(0xffcc66) }, // Golden glow
                starIntensity: { value: 0.0 }                       // Stars visibility (0 to 1)
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 sunDirection;
                uniform vec3 topColor;
                uniform vec3 horizonColor;
                uniform vec3 groundColor;
                uniform vec3 sunColor;
                uniform vec3 sunGlowColor;
                uniform float starIntensity;
                
                // Improved pseudo-random for stars (3D Based)
                float random(vec3 scale, float seed) {
                    return fract(sin(dot(gl_FragCoord.xyz + seed, scale)) * 43758.5453 + seed);
                }
                // Hash based on direction for static stars
                float hash(vec3 p) {
                    p = fract(p * 0.3183099 + .1);
                    p *= 17.0;
                    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
                }
                
                varying vec3 vWorldPosition;
                
                void main() {
                    // Normalize direction from origin
                    vec3 direction = normalize(vWorldPosition);
                    
                    // Height factor: 1 at top, 0 at horizon, negative below
                    float height = direction.y;
                    
                    vec3 skyColor;
                    
                    if (height > 0.0) {
                        // Above horizon: gradient from horizon to zenith
                        float factor = pow(height, 0.5);
                        skyColor = mix(horizonColor, topColor, factor);
                    } else {
                        // Below horizon: fade to ground color
                        float factor = pow(abs(height), 0.7);
                        skyColor = mix(horizonColor, groundColor, factor);
                    }
                    
                    // Stars (only visible when starIntensity > 0)
                    if (starIntensity > 0.0 && height > 0.1) {
                         // Map direction to a grid to create stable stars
                         vec3 dir = direction * 100.0; // Scale determines density
                         float h = hash(floor(dir));
                         
                         // Threshold for stars
                         if (h > 0.99) { // 1% chance per grid cell
                             float brightness = (h - 0.99) * 100.0 * starIntensity;
                             // Twinkle
                             float twinkle = sin(length(dir) + starIntensity * 10.0);
                             brightness *= (0.5 + 0.5 * twinkle);
                             skyColor += vec3(brightness);
                         }
                    }
                    
                    // Sun disc - simple like Minecraft
                    float sunAngle = dot(direction, sunDirection);
                    
                    // Sharp-edged sun disc (no smooth glow)
                    float sunDisc = step(0.997, sunAngle);
                    
                    // Just a subtle warm tint around sun, not intense glow
                    float sunTint = pow(max(0.0, sunAngle), 8.0) * 0.15;
                    skyColor += sunGlowColor * sunTint;
                    
                    // Apply simple sun disc
                    skyColor = mix(skyColor, sunColor, sunDisc);
                    
                    gl_FragColor = vec4(skyColor, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
            fog: false // Important! Ensure sky is not obscured by scene fog
        });

        const skyDome = new THREE.Mesh(geometry, material);
        skyDome.frustumCulled = false; // Always render, even when camera is inside

        return skyDome;
    }

    public updateTheme(colors: ThemeColors): void {
        const mat = this.mesh.material as THREE.ShaderMaterial;
        mat.uniforms.topColor.value.set(colors.skyTop);
        mat.uniforms.horizonColor.value.set(colors.skyHorizon);
        mat.uniforms.groundColor.value.set(colors.skyGround);
        // Update sun colors based on theme too?
        if (colors.skyTop === '#1e90ff') { // Dark/Night (Heuristic from previous implementation, logic will change in ThemeManager)
            // Actually, we should check luminance of skyTop to panic-switch to night?
            // For now, rely on ThemeManager sending a very dark skyTop.

            // If skyTop is dark, show stars
            const topCol = new THREE.Color(colors.skyTop);
            if (topCol.getHSL({ h: 0, s: 0, l: 0 }).l < 0.5) {
                mat.uniforms.sunColor.value.set(0xffffee);
                mat.uniforms.sunGlowColor.value.set(0xffaa33);
                mat.uniforms.starIntensity.value = 1.0;
            } else {
                mat.uniforms.sunColor.value.set(0xfffff0);
                mat.uniforms.sunGlowColor.value.set(0xffcc66);
                mat.uniforms.starIntensity.value = 0.0;
            }
        } else {
            // Default check based on string value (legacy check until ThemeManager is fixed)
            mat.uniforms.sunColor.value.set(0xfffff0);
            mat.uniforms.sunGlowColor.value.set(0xffcc66);
            mat.uniforms.starIntensity.value = 0.0;
        }
    }

    public dispose(): void {
        this.mesh.geometry.dispose();
        if (this.mesh.material instanceof THREE.Material) {
            this.mesh.material.dispose();
        }
    }
}

// ============================================================================
// CLOUD SYSTEM
// ============================================================================

interface Cloud {
    group: THREE.Group;
    baseX: number;
    baseZ: number;
    speed: number;
}

/**
 * Creates animated volumetric clouds
 */
export class CloudSystem {
    public readonly group: THREE.Group;
    private clouds: Cloud[] = [];
    private time: number = 0;

    constructor() {
        this.group = new THREE.Group();
        this.createClouds();
    }

    private createClouds(): void {
        const cloudCount = 25;

        // Cloud material - soft white with transparency
        const cloudMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.85,
        });

        for (let i = 0; i < cloudCount; i++) {
            const cloudGroup = new THREE.Group();

            // Each cloud is made of several merged spheres
            const puffCount = 5 + Math.floor(Math.random() * 6);
            const baseScale = 8 + Math.random() * 12;

            for (let j = 0; j < puffCount; j++) {
                const puffGeom = new THREE.SphereGeometry(
                    baseScale * (0.6 + Math.random() * 0.6),
                    8,
                    6
                );
                const puff = new THREE.Mesh(puffGeom, cloudMaterial);

                // Position puffs to form cloud shape
                puff.position.set(
                    (Math.random() - 0.5) * baseScale * 2,
                    (Math.random() - 0.3) * baseScale * 0.5,
                    (Math.random() - 0.5) * baseScale * 1.5
                );

                // Scale variation
                const s = 0.7 + Math.random() * 0.6;
                puff.scale.set(s, s * 0.6, s);

                cloudGroup.add(puff);
            }

            // Position cloud in the sky
            const angle = (i / cloudCount) * Math.PI * 2 + Math.random() * 0.5;
            const radius = 200 + Math.random() * 350;
            const x = Math.cos(angle) * radius;
            const z = Math.sin(angle) * radius;
            const y = 80 + Math.random() * 60;

            cloudGroup.position.set(x, y, z);

            // Random initial rotation
            cloudGroup.rotation.y = Math.random() * Math.PI * 2;

            this.group.add(cloudGroup);

            this.clouds.push({
                group: cloudGroup,
                baseX: x,
                baseZ: z,
                speed: 2 + Math.random() * 3
            });
        }
    }

    /**
     * Update cloud positions for animation
     */
    public update(deltaTime: number): void {
        this.time += deltaTime;

        for (const cloud of this.clouds) {
            // Gentle drifting motion
            const drift = this.time * cloud.speed;
            cloud.group.position.x = cloud.baseX + Math.sin(drift * 0.02) * 20;
            cloud.group.position.z = cloud.baseZ + Math.cos(drift * 0.015) * 15;

            // Subtle bobbing
            cloud.group.position.y += Math.sin(this.time * 0.5 + cloud.baseX) * 0.01;
        }
    }

    public dispose(): void {
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (child.material instanceof THREE.Material) {
                    child.material.dispose();
                }
            }
        });
    }
}

// ============================================================================
// DISTANT TERRAIN
// ============================================================================

/**
 * Creates distant hills and terrain features around the flat park
 */
export class DistantTerrain {
    public readonly group: THREE.Group;
    private hillMaterial!: THREE.MeshLambertMaterial;
    private mountainMaterial!: THREE.MeshLambertMaterial;
    private treeMaterial!: THREE.MeshLambertMaterial;

    constructor() {
        this.group = new THREE.Group();
        this.createTerrain();
    }

    private createTerrain(): void {
        // Create terrain ring around the flat park area
        this.createHillRing();
        this.createMountains();
        this.createForestPatches();
    }

    /**
     * Create gentle rolling hills around the park perimeter
     */
    private createHillRing(): void {
        this.hillMaterial = new THREE.MeshLambertMaterial({
            color: 0x4a7c23,
            flatShading: true,
        });

        const hillMaterial = this.hillMaterial;

        // Create hills at various angles around the park
        const hillCount = 16;
        for (let i = 0; i < hillCount; i++) {
            const angle = (i / hillCount) * Math.PI * 2;
            const radius = 450 + Math.random() * 100;

            const hill = this.createHill(
                30 + Math.random() * 50,  // base radius
                15 + Math.random() * 25,  // height
                hillMaterial
            );

            hill.position.set(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );

            hill.rotation.y = Math.random() * Math.PI * 2;

            this.group.add(hill);
        }
    }

    /**
     * Create a single hill with clean geometry
     */
    private createHill(baseRadius: number, height: number, material: THREE.Material): THREE.Mesh {
        // Simple clean cone - no vertex displacement to avoid artifacts
        const geometry = new THREE.ConeGeometry(baseRadius, height, 8, 1);

        const hill = new THREE.Mesh(geometry, material);
        hill.position.y = height / 2 - 2; // Sink into ground slightly
        hill.castShadow = true;
        hill.receiveShadow = true;

        return hill;
    }

    /**
     * Create distant mountain range
     */
    private createMountains(): void {
        this.mountainMaterial = new THREE.MeshLambertMaterial({
            color: 0x6b7d7d,
            flatShading: true,
        });

        const mountainMaterial = this.mountainMaterial;

        const snowCapMaterial = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            flatShading: true,
        });

        // Northern mountain range
        for (let i = 0; i < 8; i++) {
            const angle = -Math.PI / 2 + (i - 4) * 0.15 + Math.random() * 0.1;
            const radius = 550 + Math.random() * 50;

            const mountain = this.createMountain(
                60 + Math.random() * 40,
                80 + Math.random() * 60,
                mountainMaterial,
                snowCapMaterial
            );

            mountain.position.set(
                Math.cos(angle) * radius,
                0,
                Math.sin(angle) * radius
            );

            this.group.add(mountain);
        }
    }

    /**
     * Create a mountain with optional snow cap - using clean geometry
     */
    private createMountain(baseRadius: number, height: number,
        rockMaterial: THREE.Material, snowMaterial: THREE.Material): THREE.Group {
        const mountainGroup = new THREE.Group();

        // Main mountain body - simple clean cone
        const bodyGeom = new THREE.ConeGeometry(baseRadius, height, 6, 1);
        const body = new THREE.Mesh(bodyGeom, rockMaterial);
        body.position.y = height / 2 - 5;
        body.castShadow = true;
        body.receiveShadow = true;
        mountainGroup.add(body);

        // Add a secondary smaller peak for more interesting silhouette
        const peakGeom = new THREE.ConeGeometry(baseRadius * 0.5, height * 0.6, 5, 1);
        const peak = new THREE.Mesh(peakGeom, rockMaterial);
        peak.position.set(baseRadius * 0.3, height * 0.4, baseRadius * 0.2);
        peak.castShadow = true;
        mountainGroup.add(peak);

        // Snow cap (top portion)
        if (height > 80) {
            const capHeight = height * 0.2;
            const capRadius = baseRadius * 0.25;
            const capGeom = new THREE.ConeGeometry(capRadius, capHeight, 6, 1);
            const cap = new THREE.Mesh(capGeom, snowMaterial);
            cap.position.y = height - capHeight / 2 - 5;
            mountainGroup.add(cap);
        }

        return mountainGroup;
    }

    /**
     * Create scattered forest patches
     */
    private createForestPatches(): void {
        this.treeMaterial = new THREE.MeshLambertMaterial({
            color: 0x2d5a1e,
            flatShading: true,
        });

        const treeMaterial = this.treeMaterial;

        const trunkMaterial = new THREE.MeshLambertMaterial({
            color: 0x5d4037,
        });

        // Create forest clusters
        const clusterCount = 12;
        for (let c = 0; c < clusterCount; c++) {
            const clusterAngle = (c / clusterCount) * Math.PI * 2 + Math.random() * 0.3;
            const clusterRadius = 420 + Math.random() * 80;
            const clusterX = Math.cos(clusterAngle) * clusterRadius;
            const clusterZ = Math.sin(clusterAngle) * clusterRadius;

            // Trees per cluster
            const treeCount = 8 + Math.floor(Math.random() * 12);
            for (let t = 0; t < treeCount; t++) {
                const tree = this.createTree(
                    3 + Math.random() * 4,
                    12 + Math.random() * 10,
                    treeMaterial,
                    trunkMaterial
                );

                tree.position.set(
                    clusterX + (Math.random() - 0.5) * 60,
                    0,
                    clusterZ + (Math.random() - 0.5) * 60
                );

                tree.rotation.y = Math.random() * Math.PI * 2;
                this.group.add(tree);
            }
        }
    }

    /**
     * Create a simple tree
     */
    private createTree(trunkRadius: number, height: number,
        foliageMaterial: THREE.Material, trunkMaterial: THREE.Material): THREE.Group {
        const treeGroup = new THREE.Group();

        // Trunk
        const trunkHeight = height * 0.3;
        const trunkGeom = new THREE.CylinderGeometry(
            trunkRadius * 0.6,
            trunkRadius,
            trunkHeight,
            6
        );
        const trunk = new THREE.Mesh(trunkGeom, trunkMaterial);
        trunk.position.y = trunkHeight / 2;
        trunk.castShadow = true;
        treeGroup.add(trunk);

        // Foliage (cone shape)
        const foliageHeight = height * 0.8;
        const foliageRadius = trunkRadius * 3;
        const foliageGeom = new THREE.ConeGeometry(foliageRadius, foliageHeight, 8, 3);
        const foliage = new THREE.Mesh(foliageGeom, foliageMaterial);
        foliage.position.y = trunkHeight + foliageHeight / 2 - 2;
        foliage.castShadow = true;
        treeGroup.add(foliage);

        return treeGroup;
    }

    public updateTheme(colors: ThemeColors): void {
        if (this.hillMaterial) {
            this.hillMaterial.color.set(colors.mountainColor); // Hills match mountains or separate? Maybe separate.
            // Actually hills should be grassy.
            this.hillMaterial.color.set(colors.grassColor);
        }
        if (this.mountainMaterial) {
            this.mountainMaterial.color.set(colors.mountainColor);
        }
        if (this.treeMaterial) {
            this.treeMaterial.color.set(colors.treeFoliage);
        }
        // Iterate children to find trunks?
        // Or store trunk material reference
    }

    public dispose(): void {
        this.group.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.dispose();
                if (child.material instanceof THREE.Material) {
                    child.material.dispose();
                }
            }
        });
    }
}

// ============================================================================
// ENHANCED GRASS TEXTURE
// ============================================================================

/**
 * Creates a seamlessly tiling grass texture
 * Uses modular wrapping to ensure elements near edges appear on both sides
 */
export function createEnhancedGrassTexture(theme?: ThemeColors): THREE.Texture {
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) { return new THREE.Texture(); }

    // Solid base color (gradients don't tile well)
    // Use theme colors if provided, else default
    const baseColor = theme ? theme.grassColor : '#4a7c23';
    const shadowColor = theme ? theme.grassShadow : '#2d5a1e';
    const highlightColor = theme ? theme.grassHighlight : '#7bc03e';

    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // Generate palette from base colors
    const grassColors = [
        shadowColor,
        baseColor,
        highlightColor,
    ];

    // Helper to draw at position with seamless wrapping
    const drawWrapped = (x: number, y: number, drawFn: (wx: number, wy: number) => void) => {
        // Draw at original position
        drawFn(x, y);
        // Wrap horizontally
        if (x < 20) drawFn(x + size, y);
        if (x > size - 20) drawFn(x - size, y);
        // Wrap vertically
        if (y < 20) drawFn(x, y + size);
        if (y > size - 20) drawFn(x, y - size);
        // Wrap corners
        if (x < 20 && y < 20) drawFn(x + size, y + size);
        if (x > size - 20 && y < 20) drawFn(x - size, y + size);
        if (x < 20 && y > size - 20) drawFn(x + size, y - size);
        if (x > size - 20 && y > size - 20) drawFn(x - size, y - size);
    };

    // Use seeded random for consistent results
    let seed = 12345;
    const seededRandom = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        return seed / 0x7fffffff;
    };

    // Draw layered grass blades for depth
    const layers = 3;
    for (let layer = 0; layer < layers; layer++) {
        const bladeCount = 3000 + layer * 2000;
        const bladeOpacity = 0.3 + layer * 0.25;

        for (let i = 0; i < bladeCount; i++) {
            const x = seededRandom() * size;
            const y = seededRandom() * size;
            const bladeWidth = 0.5 + seededRandom() * 1.5;
            const bladeHeight = 4 + seededRandom() * (8 + layer * 3);
            const angle = (seededRandom() - 0.5) * 0.3;
            const color = grassColors[Math.floor(seededRandom() * grassColors.length)];
            const alpha = bladeOpacity + seededRandom() * 0.3;

            drawWrapped(x, y, (wx, wy) => {
                ctx.save();
                ctx.translate(wx, wy);
                ctx.rotate(angle);
                ctx.fillStyle = color;
                ctx.globalAlpha = alpha;
                ctx.fillRect(-bladeWidth / 2, 0, bladeWidth, bladeHeight);
                ctx.restore();
            });
        }
    }

    // Add bright highlights (sunlit grass tips)
    ctx.globalAlpha = 1;
    for (let i = 0; i < 800; i++) {
        const x = seededRandom() * size;
        const y = seededRandom() * size;
        const radius = 0.5 + seededRandom() * 1.5;
        const alpha = 0.3 + seededRandom() * 0.3;

        drawWrapped(x, y, (wx, wy) => {
            ctx.beginPath();
            ctx.arc(wx, wy, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(150, 200, 80, ${alpha})`;
            ctx.fill();
        });
    }

    // Add subtle shadow patches
    for (let i = 0; i < 200; i++) {
        const x = seededRandom() * size;
        const y = seededRandom() * size;
        const radius = 4 + seededRandom() * 10;
        const alpha = 0.08 + seededRandom() * 0.08;

        drawWrapped(x, y, (wx, wy) => {
            ctx.beginPath();
            ctx.arc(wx, wy, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(30, 60, 15, ${alpha})`;
            ctx.fill();
        });
    }

    // Add small flower/clover dots occasionally
    for (let i = 0; i < 100; i++) {
        const x = seededRandom() * size;
        const y = seededRandom() * size;
        const isYellow = seededRandom() > 0.5;

        if (isYellow) {
            const radius = 1 + seededRandom();
            const alpha = 0.5 + seededRandom() * 0.3;
            drawWrapped(x, y, (wx, wy) => {
                ctx.beginPath();
                ctx.arc(wx, wy, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 235, 100, ${alpha})`;
                ctx.fill();
            });
        } else {
            const radius = 1.5 + seededRandom();
            const alpha = 0.3 + seededRandom() * 0.2;
            drawWrapped(x, y, (wx, wy) => {
                ctx.beginPath();
                ctx.arc(wx, wy, radius, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                ctx.fill();
            });
        }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(60, 60); // Repeat across the large ground

    return texture;
}

// ============================================================================
// ENVIRONMENT MANAGER
// ============================================================================

/**
 * Main environment manager that combines all systems
 */
export class Environment {
    public readonly sky: ProceduralSky;
    public readonly clouds: CloudSystem;
    public readonly terrain: DistantTerrain;

    constructor(scene: THREE.Scene) {
        // Create all environment components
        this.sky = new ProceduralSky();
        this.clouds = new CloudSystem();
        this.terrain = new DistantTerrain();

        // Add to scene
        scene.add(this.sky.mesh);
        scene.add(this.clouds.group);
        scene.add(this.terrain.group);

        // Keep a fallback background color in case sky has issues
        scene.background = new THREE.Color(0x87ceeb);
    }

    /**
     * Update animated elements (call from render loop)
     */
    public update(deltaTime: number): void {
        this.clouds.update(deltaTime);
    }

    public updateTheme(theme: ThemeColors): void {
        this.sky.updateTheme(theme);
        this.terrain.updateTheme(theme);
    }

    public dispose(): void {
        this.sky.dispose();
        this.clouds.dispose();
        this.terrain.dispose();
    }
}

/**
 * Creates a seamless pathway texture (pavement/stone)
 */
export function createPathwayTexture(theme?: ThemeColors): THREE.Texture {
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) { return new THREE.Texture(); }

    // Base color - neutral grey or theme derived
    const baseColor = theme ? theme.pathway : '#666666';
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, size, size);

    // Add noise/texture
    for (let i = 0; i < 5000; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = Math.random() * 2;
        const shade = Math.floor(Math.random() * 40 + 90); // 90-130

        // If we have a theme, we want noise to be a variation of the base color, not just grey
        if (theme) {
            const baseHigh = new THREE.Color(theme.pathway).offsetHSL(0, 0, 0.1).getStyle();
            ctx.fillStyle = baseHigh;
            ctx.globalAlpha = 0.1;
        } else {
            ctx.fillStyle = `rgb(${shade}, ${shade}, ${shade})`;
            ctx.globalAlpha = 1.0;
        }
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // Add some larger flagstone-like patterns
    ctx.strokeStyle = theme ? new THREE.Color(theme.pathway).offsetHSL(0, 0, -0.1).getStyle() : '#555555';
    ctx.lineWidth = 2;
    // ... simple geometric pattern or just noise is fine for now
    // Let's stick to a nice asphalt/gravel noise

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(100, 100); // Dense repeat for fine grain

    return texture;
}
