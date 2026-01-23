import * as THREE from 'three';
import { Environment, createEnhancedGrassTexture, createPathwayTexture } from './environment';

export class SceneManager {
    public readonly scene: THREE.Scene;
    public readonly camera: THREE.PerspectiveCamera;
    public readonly renderer: THREE.WebGLRenderer;
    public readonly environment: Environment;

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
        // Background handled by procedural sky now
        scene.fog = new THREE.FogExp2(0x9bc5e8, 0.0015); // Exponential fog for depth
        return scene;
    }

    private createCamera(): THREE.PerspectiveCamera {
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1200  // Extended far plane for distant terrain
        );
        return camera;
    }

    private createRenderer(container: HTMLElement): THREE.WebGLRenderer {
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.3; // Slightly brighter for outdoor scene
        container.appendChild(renderer.domElement);
        return renderer;
    }

    private addLighting(): void {
        // Hemisphere light for natural sky/ground lighting
        const hemiLight = new THREE.HemisphereLight(0x87ceeb, 0x4a7c23, 0.6);
        hemiLight.position.set(0, 200, 0);
        this.scene.add(hemiLight);

        // Sun-like directional light (matches sky sun position)
        const sunLight = new THREE.DirectionalLight(0xfffaf0, 1.4);
        sunLight.position.set(200, 150, 100);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 600;
        sunLight.shadow.camera.left = -300;
        sunLight.shadow.camera.right = 300;
        sunLight.shadow.camera.top = 300;
        sunLight.shadow.camera.bottom = -300;
        sunLight.shadow.bias = -0.0005;
        this.scene.add(sunLight);

        // Warm ambient to soften shadows
        const ambientLight = new THREE.AmbientLight(0xfff8e7, 0.5);
        this.scene.add(ambientLight);

        // Fill light from opposite side
        const fillLight = new THREE.DirectionalLight(0xadd8e6, 0.3);
        fillLight.position.set(-100, 50, -100);
        this.scene.add(fillLight);
    }

    private addGround(): void {
        // Global ground is grass (wilderness)
        const grassTexture = createEnhancedGrassTexture();

        // Larger ground for expanded park (1200x1200 to extend beyond visible area)
        const groundGeometry = new THREE.PlaneGeometry(1200, 1200);
        const groundMaterial = new THREE.MeshLambertMaterial({
            map: grassTexture,
            transparent: false
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.2; // Significantly below foundation to avoid z-fighting
        ground.receiveShadow = true;
        this.scene.add(ground);
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
}
