/**
 * Environment Visual Systems
 * 
 * Provides immersive environment features for the 3D code park:
 * - Procedural sky with gradient and sun
 * - Animated cloud system
 * - Distant terrain with biomes and hills
 */
import * as THREE from 'three';

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
        });

        const skyDome = new THREE.Mesh(geometry, material);
        skyDome.frustumCulled = false; // Always render, even when camera is inside

        return skyDome;
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
}

// ============================================================================
// DISTANT TERRAIN
// ============================================================================

/**
 * Creates distant hills and terrain features around the flat park
 */
export class DistantTerrain {
    public readonly group: THREE.Group;

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
        const hillMaterial = new THREE.MeshLambertMaterial({
            color: 0x4a7c23,
            flatShading: true,
        });

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
        const mountainMaterial = new THREE.MeshLambertMaterial({
            color: 0x6b7d7d,
            flatShading: true,
        });

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
        const treeMaterial = new THREE.MeshLambertMaterial({
            color: 0x2d5a1e,
            flatShading: true,
        });

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
}

// ============================================================================
// ENHANCED GRASS TEXTURE
// ============================================================================

/**
 * Creates an improved procedural grass texture with more detail
 */
export function createEnhancedGrassTexture(): THREE.Texture {
    const canvas = document.createElement('canvas');
    const size = 512;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Base gradient for depth
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#4a7c23');
    gradient.addColorStop(0.5, '#3d6b1e');
    gradient.addColorStop(1, '#4a7c23');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    // Rich grass color palette
    const grassColors = [
        '#2d5a1e', // very dark green
        '#3d6b1e', // dark green
        '#4a7c23', // base green
        '#5a8f2a', // medium green
        '#6ba832', // light green
        '#7bc03e', // bright green
        '#558b2f', // olive green
    ];

    // Draw layered grass blades for depth
    const layers = 3;
    for (let layer = 0; layer < layers; layer++) {
        const bladeCount = 3000 + layer * 2000;
        const bladeOpacity = 0.3 + layer * 0.25;

        for (let i = 0; i < bladeCount; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const bladeWidth = 0.5 + Math.random() * 1.5;
            const bladeHeight = 4 + Math.random() * (8 + layer * 3);
            const angle = (Math.random() - 0.5) * 0.3; // Slight angle variation

            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(angle);

            const color = grassColors[Math.floor(Math.random() * grassColors.length)];
            ctx.fillStyle = color;
            ctx.globalAlpha = bladeOpacity + Math.random() * 0.3;
            ctx.fillRect(-bladeWidth / 2, 0, bladeWidth, bladeHeight);

            ctx.restore();
        }
    }

    // Add bright highlights (sunlit grass tips)
    ctx.globalAlpha = 1;
    for (let i = 0; i < 800; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = 0.5 + Math.random() * 1.5;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(150, 200, 80, ${0.3 + Math.random() * 0.3})`;
        ctx.fill();
    }

    // Add subtle shadow patches
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;
        const radius = 4 + Math.random() * 10;

        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(30, 60, 15, ${0.08 + Math.random() * 0.08})`;
        ctx.fill();
    }

    // Add small flower/clover dots occasionally
    for (let i = 0; i < 100; i++) {
        const x = Math.random() * size;
        const y = Math.random() * size;

        // Yellow flowers
        if (Math.random() > 0.5) {
            ctx.beginPath();
            ctx.arc(x, y, 1 + Math.random(), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 235, 100, ${0.5 + Math.random() * 0.3})`;
            ctx.fill();
        } else {
            // White clovers
            ctx.beginPath();
            ctx.arc(x, y, 1.5 + Math.random(), 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + Math.random() * 0.2})`;
            ctx.fill();
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
}
