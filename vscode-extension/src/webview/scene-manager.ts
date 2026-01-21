import * as THREE from 'three';


export class SceneManager {
    public readonly scene: THREE.Scene;
    public readonly camera: THREE.PerspectiveCamera;
    public readonly renderer: THREE.WebGLRenderer;

    constructor(container: HTMLElement, vscodeApi?: any) {
        this.scene = this.createScene();
        this.camera = this.createCamera();
        this.renderer = this.createRenderer(container);

        this.addLighting();
        this.addGround();
        this.addAtmosphere();

        window.addEventListener('resize', () => this.onResize());
    }

    private createScene(): THREE.Scene {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87ceeb); // Sky blue
        scene.fog = new THREE.Fog(0x87ceeb, 200, 600); // Extended fog for larger park
        return scene;
    }

    private createCamera(): THREE.PerspectiveCamera {
        const camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        return camera;
    }

    private createRenderer(container: HTMLElement): THREE.WebGLRenderer {
        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.2; // brighter
        container.appendChild(renderer.domElement);
        return renderer;
    }

    private addLighting(): void {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
        this.scene.add(ambientLight);

        // Sun-like directional light
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
        sunLight.position.set(100, 100, 50);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -250;
        sunLight.shadow.camera.right = 250;
        sunLight.shadow.camera.top = 250;
        sunLight.shadow.camera.bottom = -250;
        this.scene.add(sunLight);

        // Warm fill light
        const fillLight = new THREE.DirectionalLight(0xfff4e6, 0.4);
        fillLight.position.set(-50, 30, -50);
        this.scene.add(fillLight);
    }

    private addGround(): void {
        // Create procedural grass texture
        const grassTexture = this.createGrassTexture();

        // Larger ground for expanded park (1000x1000)
        const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
        const groundMaterial = new THREE.MeshLambertMaterial({
            map: grassTexture,
            transparent: false
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    /**
     * Create a procedural grass texture using canvas
     */
    private createGrassTexture(): THREE.Texture {
        const canvas = document.createElement('canvas');
        const size = 512;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d')!;

        // Base grass color
        ctx.fillStyle = '#4a7c23';
        ctx.fillRect(0, 0, size, size);

        // Add grass color variations
        const grassColors = [
            '#3d6b1e', // dark green
            '#5a8f2a', // medium green
            '#6ba832', // light green
            '#4a7c23', // base green
            '#3e6920', // darker green
        ];

        // Draw random grass blades/patches
        for (let i = 0; i < 8000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const bladeWidth = 1 + Math.random() * 2;
            const bladeHeight = 3 + Math.random() * 8;

            ctx.fillStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
            ctx.fillRect(x, y, bladeWidth, bladeHeight);
        }

        // Add some lighter spots for depth
        for (let i = 0; i < 500; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const radius = 2 + Math.random() * 6;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(120, 180, 60, ${0.1 + Math.random() * 0.2})`;
            ctx.fill();
        }

        // Add some darker patches for shadows/depth
        for (let i = 0; i < 300; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const radius = 3 + Math.random() * 8;

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(40, 70, 20, ${0.1 + Math.random() * 0.15})`;
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(50, 50); // Repeat across the large ground

        return texture;
    }

    private addAtmosphere(): void {
        const particleCount = 100;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);

        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 200;      // x
            positions[i + 1] = Math.random() * 50 + 10;      // y
            positions[i + 2] = (Math.random() - 0.5) * 200;  // z
        }

        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            transparent: true,
            opacity: 0.3,
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
