import * as THREE from 'three';

// VSCode API for webview communication
declare const acquireVsCodeApi: () => {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

interface CodeObject {
    id: string;
    type: 'file' | 'module' | 'class' | 'function';
    filePath: string;
    position: THREE.Vector3;
    mesh: THREE.Mesh;
    metadata: any;
}

class WorldRenderer {
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private vscode: any;
    private objects: Map<string, CodeObject> = new Map();
    private selectedObject: CodeObject | null = null;
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private mouse: THREE.Vector2 = new THREE.Vector2();
    
    // Character-based navigation
    private controls = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        up: false,
        down: false,
        flightMode: false
    };
    
    // Character physics
    private characterPosition = new THREE.Vector3(0, 2, 20);
    private characterVelocity = new THREE.Vector3();
    private characterDirection = new THREE.Vector3();
    private yaw = 0; // Horizontal rotation
    private pitch = 0; // Vertical rotation
    
    // Movement settings
    private moveSpeed = 8.0;
    private sprintMultiplier = 2.0;
    private jumpForce = 12.0;
    private gravity = -25.0;
    private friction = 8.0;
    private airFriction = 2.0;
    private mouseSensitivity = 0.002;
    
    // Character state
    private isOnGround = false;
    private groundHeight = 0.5;
    private characterHeight = 1.8;
    private isPointerLocked = false;
    
    // UI elements
    private loadingElement: HTMLElement;
    private statsElement: HTMLElement;
    private frameCount = 0;
    private lastTime = 0;
    private fps = 0;

    constructor() {
        this.vscode = acquireVsCodeApi();
        this.loadingElement = document.getElementById('loading')!;
        this.statsElement = document.getElementById('stats')!;
        
        this.initScene();
        this.initControls();
        this.animate();
        
        // Notify extension that webview is ready
        this.vscode.postMessage({ type: 'ready' });
    }

    private initScene(): void {
        // Create scene with bright daytime sky
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
        this.scene.fog = new THREE.Fog(0x87CEEB, 100, 300); // Light blue fog for atmosphere

        // Create camera with character-like FOV
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        
        // Position camera at character eye level
        this.updateCameraFromCharacter();

        // Create renderer
        const container = document.getElementById('renderer')!;
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2; // Brighter exposure
        container.appendChild(this.renderer.domElement);

        // Add bright ambient light (like scattered sunlight)
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.8); // Bright white ambient
        this.scene.add(ambientLight);

        // Add sun-like directional light
        const sunLight = new THREE.DirectionalLight(0xffffff, 1.2); // Bright sun
        sunLight.position.set(100, 100, 50); // High in the sky
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 500;
        sunLight.shadow.camera.left = -100;
        sunLight.shadow.camera.right = 100;
        sunLight.shadow.camera.top = 100;
        sunLight.shadow.camera.bottom = -100;
        this.scene.add(sunLight);

        // Add warm fill light (like reflected sunlight)
        const fillLight = new THREE.DirectionalLight(0xfff4e6, 0.4); // Warm fill
        fillLight.position.set(-50, 30, -50);
        this.scene.add(fillLight);

        // Add beautiful grass-like ground plane
        const groundGeometry = new THREE.PlaneGeometry(400, 400);
        const groundMaterial = new THREE.MeshLambertMaterial({ 
            color: 0x90EE90, // Light green grass
            transparent: true,
            opacity: 0.9
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Add some atmospheric particles/dust motes for depth
        this.addAtmosphericParticles();

        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
        
        // Handle mouse events
        this.renderer.domElement.addEventListener('click', (event) => this.onMouseClick(event));
        this.renderer.domElement.addEventListener('dblclick', (event) => this.onMouseDoubleClick(event));
        this.renderer.domElement.addEventListener('mousemove', (event) => this.onMouseMove(event));

        this.hideLoading();
    }

    private addAtmosphericParticles(): void {
        // Create floating particles for atmosphere
        const particleCount = 100;
        const particles = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        
        for (let i = 0; i < particleCount * 3; i += 3) {
            positions[i] = (Math.random() - 0.5) * 200; // x
            positions[i + 1] = Math.random() * 50 + 10; // y (floating in air)
            positions[i + 2] = (Math.random() - 0.5) * 200; // z
        }
        
        particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const particleMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 2,
            transparent: true,
            opacity: 0.3,
            sizeAttenuation: true
        });
        
        const particleSystem = new THREE.Points(particles, particleMaterial);
        this.scene.add(particleSystem);
    }

    private updateCameraFromCharacter(): void {
        // Position camera at character's eye level
        this.camera.position.copy(this.characterPosition);
        this.camera.position.y += this.characterHeight * 0.9; // Eye level
        
        // Apply rotation
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = this.pitch;
    }

    private initControls(): void {
        // Keyboard controls
        document.addEventListener('keydown', (event) => this.onKeyDown(event));
        document.addEventListener('keyup', (event) => this.onKeyUp(event));
        
        // Pointer lock controls
        document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
        document.addEventListener('pointerlockerror', () => {
            console.error('Pointer lock error');
        });
    }

    private onKeyDown(event: KeyboardEvent): void {
        switch (event.code) {
            case 'KeyW':
                this.controls.forward = true;
                break;
            case 'KeyS':
                this.controls.backward = true;
                break;
            case 'KeyA':
                this.controls.left = true;
                break;
            case 'KeyD':
                this.controls.right = true;
                break;
            case 'Space':
                if (this.controls.flightMode) {
                    this.controls.up = true;
                } else if (this.isOnGround) {
                    // Jump
                    this.characterVelocity.y = this.jumpForce;
                    this.isOnGround = false;
                }
                event.preventDefault();
                break;
            case 'KeyC':
                if (this.controls.flightMode) {
                    this.controls.down = true;
                }
                break;
            case 'KeyF':
                this.controls.flightMode = !this.controls.flightMode;
                console.log('Flight mode:', this.controls.flightMode ? 'ON' : 'OFF');
                // Reset vertical velocity when toggling flight mode
                if (!this.controls.flightMode) {
                    this.characterVelocity.y = 0;
                    this.characterPosition.y = Math.max(this.groundHeight + this.characterHeight, this.characterPosition.y);
                }
                break;
            case 'Escape':
                if (this.isPointerLocked) {
                    document.exitPointerLock();
                }
                break;
        }
    }

    private onKeyUp(event: KeyboardEvent): void {
        switch (event.code) {
            case 'KeyW':
                this.controls.forward = false;
                break;
            case 'KeyS':
                this.controls.backward = false;
                break;
            case 'KeyA':
                this.controls.left = false;
                break;
            case 'KeyD':
                this.controls.right = false;
                break;
            case 'Space':
                this.controls.up = false;
                break;
            case 'KeyC':
                this.controls.down = false;
                break;
        }
    }

    private onMouseClick(event: MouseEvent): void {
        if (!this.isPointerLocked) {
            // Request pointer lock on first click
            this.renderer.domElement.requestPointerLock();
            return;
        }

        // Handle object selection
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(
            Array.from(this.objects.values()).map(obj => obj.mesh)
        );

        if (intersects.length > 0) {
            const intersectedMesh = intersects[0].object as THREE.Mesh;
            const codeObject = Array.from(this.objects.values()).find(obj => obj.mesh === intersectedMesh);
            
            if (codeObject) {
                this.selectObject(codeObject);
            }
        } else {
            this.deselectObject();
        }
    }

    private onMouseDoubleClick(event: MouseEvent): void {
        if (this.selectedObject) {
            this.vscode.postMessage({
                type: 'openFile',
                data: {
                    filePath: this.selectedObject.filePath
                }
            });
        }
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.isPointerLocked) return;

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        // Update character rotation (yaw and pitch)
        this.yaw -= movementX * this.mouseSensitivity;
        this.pitch -= movementY * this.mouseSensitivity;
        
        // Clamp vertical rotation to prevent over-rotation
        this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
        
        // Update camera rotation
        this.updateCameraFromCharacter();
    }

    private onPointerLockChange(): void {
        this.isPointerLocked = document.pointerLockElement === this.renderer.domElement;
    }

    private onWindowResize(): void {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    private updateMovement(deltaTime: number): void {
        // Calculate movement direction based on input
        this.characterDirection.set(0, 0, 0);
        
        if (this.controls.forward) this.characterDirection.z -= 1;
        if (this.controls.backward) this.characterDirection.z += 1;
        if (this.controls.left) this.characterDirection.x -= 1;
        if (this.controls.right) this.characterDirection.x += 1;
        
        // Normalize horizontal movement
        if (this.characterDirection.x !== 0 || this.characterDirection.z !== 0) {
            this.characterDirection.normalize();
        }
        
        // Apply character rotation to movement direction
        const rotatedDirection = new THREE.Vector3();
        rotatedDirection.copy(this.characterDirection);
        rotatedDirection.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
        
        // Calculate target velocity (no sprint for now, can add later)
        const currentMoveSpeed = this.moveSpeed;
        const targetVelocity = new THREE.Vector3();
        targetVelocity.copy(rotatedDirection);
        targetVelocity.multiplyScalar(currentMoveSpeed);
        
        // Apply friction/acceleration
        const frictionForce = this.isOnGround ? this.friction : this.airFriction;
        
        // Horizontal movement with acceleration
        this.characterVelocity.x = this.lerp(this.characterVelocity.x, targetVelocity.x, frictionForce * deltaTime);
        this.characterVelocity.z = this.lerp(this.characterVelocity.z, targetVelocity.z, frictionForce * deltaTime);
        
        // Vertical movement
        if (this.controls.flightMode) {
            // Flight mode - direct vertical control
            let verticalInput = 0;
            if (this.controls.up) verticalInput += 1;
            if (this.controls.down) verticalInput -= 1;
            
            const targetVerticalVelocity = verticalInput * currentMoveSpeed;
            this.characterVelocity.y = this.lerp(this.characterVelocity.y, targetVerticalVelocity, frictionForce * deltaTime);
        } else {
            // Walking mode - apply gravity
            this.characterVelocity.y += this.gravity * deltaTime;
            
            // Ground collision
            const groundY = this.groundHeight + this.characterHeight;
            if (this.characterPosition.y <= groundY && this.characterVelocity.y <= 0) {
                this.characterPosition.y = groundY;
                this.characterVelocity.y = 0;
                this.isOnGround = true;
            } else {
                this.isOnGround = false;
            }
        }
        
        // Apply velocity to position
        this.characterPosition.addScaledVector(this.characterVelocity, deltaTime);
        
        // Update camera position and rotation
        this.updateCameraFromCharacter();
    }
    
    private lerp(start: number, end: number, factor: number): number {
        return start + (end - start) * Math.min(factor, 1);
    }

    private selectObject(codeObject: CodeObject): void {
        // Deselect previous object
        this.deselectObject();

        // Select new object
        this.selectedObject = codeObject;
        
        // Highlight selected object
        const material = codeObject.mesh.material as THREE.MeshLambertMaterial;
        material.emissive.setHex(0x444444);

        // Notify extension
        this.vscode.postMessage({
            type: 'objectSelected',
            data: {
                id: codeObject.id,
                type: codeObject.type,
                filePath: codeObject.filePath,
                metadata: codeObject.metadata
            }
        });
    }

    private deselectObject(): void {
        if (this.selectedObject) {
            // Remove highlight
            const material = this.selectedObject.mesh.material as THREE.MeshLambertMaterial;
            material.emissive.setHex(0x000000);
            this.selectedObject = null;
        }
    }

    private updateStats(deltaTime: number): void {
        this.frameCount++;
        if (this.frameCount % 60 === 0) {
            this.fps = Math.round(1 / deltaTime);
            this.statsElement.textContent = `Objects: ${this.objects.size} | FPS: ${this.fps}`;
        }
    }

    private hideLoading(): void {
        this.loadingElement.classList.add('hidden');
    }

    private animate(): void {
        requestAnimationFrame(() => this.animate());

        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        this.updateMovement(deltaTime);
        this.updateStats(deltaTime);
        this.renderer.render(this.scene, this.camera);
    }

    // Public API for extension to add objects
    public addCodeObject(data: {
        id: string;
        type: 'file' | 'module' | 'class' | 'function';
        filePath: string;
        position: { x: number; y: number; z: number };
        color?: number;
        size?: { width: number; height: number; depth: number };
        metadata?: any;
    }): void {
        const geometry = new THREE.BoxGeometry(
            data.size?.width || 1,
            data.size?.height || 1,
            data.size?.depth || 1
        );
        
        const material = new THREE.MeshLambertMaterial({
            color: data.color || 0x4CAF50
        });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(data.position.x, data.position.y, data.position.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        this.scene.add(mesh);

        const codeObject: CodeObject = {
            id: data.id,
            type: data.type,
            filePath: data.filePath,
            position: new THREE.Vector3(data.position.x, data.position.y, data.position.z),
            mesh,
            metadata: data.metadata || {}
        };

        this.objects.set(data.id, codeObject);
    }

    public removeCodeObject(id: string): void {
        const codeObject = this.objects.get(id);
        if (codeObject) {
            this.scene.remove(codeObject.mesh);
            this.objects.delete(id);
            
            if (this.selectedObject?.id === id) {
                this.selectedObject = null;
            }
        }
    }

    public clear(): void {
        this.objects.forEach(obj => {
            this.scene.remove(obj.mesh);
        });
        this.objects.clear();
        this.selectedObject = null;
    }
}

// Initialize the renderer when the page loads
let worldRenderer: WorldRenderer;

window.addEventListener('DOMContentLoaded', () => {
    worldRenderer = new WorldRenderer();
    
    // Expose renderer to global scope for extension communication
    (window as any).worldRenderer = worldRenderer;
});

// Handle messages from extension
window.addEventListener('message', event => {
    const message = event.data;
    
    switch (message.type) {
        case 'loadWorld':
            if (worldRenderer) {
                worldRenderer.clear();
                // Load world data - this will be implemented by visualizers
                console.log('Loading world data:', message.data);
            }
            break;
        case 'addObject':
            if (worldRenderer) {
                worldRenderer.addCodeObject(message.data);
            }
            break;
        case 'removeObject':
            if (worldRenderer) {
                worldRenderer.removeCodeObject(message.data.id);
            }
            break;
        case 'clear':
            if (worldRenderer) {
                worldRenderer.clear();
            }
            break;
    }
});