import * as THREE from 'three';
import { Environment, createEnhancedGrassTexture, createPathwayTexture } from './environment';

export class SceneManager {
    public readonly scene: THREE.Scene;
    public readonly camera: THREE.PerspectiveCamera;
    public readonly renderer: THREE.WebGLRenderer;
    public readonly environment: Environment;

    private hemiLight!: THREE.HemisphereLight;
    private sunLight!: THREE.DirectionalLight;
    private ambientLight!: THREE.AmbientLight;
    private fillLight!: THREE.DirectionalLight;
    private ground!: THREE.Mesh;

    constructor(container: HTMLElement, vscodeApi?: any) {
        this.scene = this.createScene();
        this.camera = this.createCamera();
        this.renderer = this.createRenderer(container);

        this.addLighting();
        this.addGround();

        // Add immersive environment (sky, clouds, distant terrain)
        this.environment = new Environment(this.scene);

        // Keep floating particles for ambient feel
        this.addAtmosphere();

        window.addEventListener('resize', () => this.onResize());
    }

    private createScene(): THREE.Scene {
        const scene = new THREE.Scene();
        // Background defaults
        scene.fog = new THREE.FogExp2(0x9bc5e8, 0.0015);
        return scene;
    }

    private createCamera(): THREE.PerspectiveCamera {
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1200
        );
        return camera;
    }

    private createRenderer(container: HTMLElement): THREE.WebGLRenderer {
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3;
        container.appendChild(renderer.domElement);
        return renderer;
    }

    private addLighting(): void {
        // Hemisphere light for natural sky/ground lighting
        this.hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a7c23, 0.6);
        this.hemiLight.position.set(0, 200, 0);
        this.scene.add(this.hemiLight);

        // Sun-like directional light
        this.sunLight = new THREE.DirectionalLight(0xfffaf0, 1.4);
        this.sunLight.position.set(200, 150, 100);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 0.5;
        this.sunLight.shadow.camera.far = 600;
        this.sunLight.shadow.camera.left = -300;
        this.sunLight.shadow.camera.right = 300;
        this.sunLight.shadow.camera.top = 300;
        this.sunLight.shadow.camera.bottom = -300;
        this.sunLight.shadow.bias = -0.0005;
        this.scene.add(this.sunLight);

        // Warm ambient
        this.ambientLight = new THREE.AmbientLight(0xfff8e7, 0.5);
        this.scene.add(this.ambientLight);

        // Fill light
        this.fillLight = new THREE.DirectionalLight(0xadd8e6, 0.3);
        this.fillLight.position.set(-100, 50, -100);
        this.scene.add(this.fillLight);
    }

    private addGround(): void {
        // Global ground is grass (wilderness)
        const grassTexture = createEnhancedGrassTexture(); // Default init

        // Larger ground for expanded park
        const groundGeometry = new THREE.PlaneGeometry(1200, 1200);
        const groundMaterial = new THREE.MeshLambertMaterial({
            map: grassTexture,
            transparent: false
        });
        this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
        this.ground.rotation.x = -Math.PI / 2;
        this.ground.position.y = -0.2;
        this.ground.receiveShadow = true;
        this.scene.add(this.ground);
    }

    private addAtmosphere(): void {
        // Floating dust/pollen particles for atmosphere
        const particleCount = 150;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 300;      // x
            positions[i + 1] = Math.random() * 60 + 5;       // y
            positions[i + 2] = (Math.random() - 0.5) * 300;  // z
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffffee,
            size: 1.5,
            transparent: true,
            opacity: 0.4,
            sizeAttenuation: true
        });

        const particleSystem = new THREE.Points(particles, material);
        this.scene.add(particleSystem);
    }

    private onResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    public updateTheme(theme: any): void {
        // 1. Propagate to Environment
        this.environment.updateTheme(theme);

        // 2. Update Ground Material
        // Re-generate texture with theme colors (grassColor)
        const newGrassTex = createEnhancedGrassTexture(theme);
        const groundMat = this.ground.material as THREE.MeshLambertMaterial;
        if (groundMat.map) groundMat.map.dispose();
        groundMat.map = newGrassTex;
        groundMat.map.needsUpdate = true;
        // Also tint the ground material slightly to match ambient? No, texture handles it.

        // 3. Update Lights
        // Hemisphere: Sky -> Ground
        this.hemiLight.color.set(theme.skyTop); // Sky color
        this.hemiLight.groundColor.set(theme.skyGround); // Ground color

        // Ambient: General tint
        // If dark theme, ambient should be dimmer
        const skyColor = new THREE.Color(theme.skyTop);
        const isDark = skyColor.getHSL({ h: 0, s: 0, l: 0 }).l < 0.2;

        if (isDark) {
            this.ambientLight.intensity = 0.3;
            this.ambientLight.color.set(theme.skyHorizon); // Moonlight-ish
            this.sunLight.intensity = 0.5; // Dim "Moon"
            this.sunLight.color.set(0xaaccff); // Cool moon light
            this.fillLight.intensity = 0.1;

            // Adjust fog color to match night sky
            this.scene.fog = new THREE.FogExp2(theme.skyHorizon, 0.0025);
        } else {
            this.ambientLight.intensity = 0.6;
            this.ambientLight.color.set(0xfff8e7); // Warm day
            this.sunLight.intensity = 1.4;
            this.sunLight.color.set(0xfffaf0); // Warm sun
            this.fillLight.intensity = 0.3;

            // Adjust fog color to match day sky
            this.scene.fog = new THREE.FogExp2(theme.skyHorizon, 0.0015);
        }
    }
}
