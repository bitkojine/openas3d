import * as THREE from 'three';

interface ControlsState {
    forward: boolean;
    backward: boolean;
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    flightMode: boolean;
}

export class CharacterController {
    public position: THREE.Vector3 = new THREE.Vector3(0, 2, 20);
    private velocity: THREE.Vector3 = new THREE.Vector3();
    public yaw: number = 0;
    public pitch: number = 0;

    private controls: ControlsState = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        up: false,
        down: false,
        flightMode: false
    };

    private isOnGround: boolean = false;
    private isPointerLocked: boolean = false;

    // Optional feature: placing a sign
    public placingSign: boolean = false;

    // Settings
    constructor(
        private camera: THREE.PerspectiveCamera,
        private domElement: HTMLElement,
        private moveSpeed: number = 8.0,
        private sprintMultiplier: number = 2.0,
        private groundHeight: number = 0.5
    ) {
        this.initInput();
    }

    private jumpForce = 12.0;
    private gravity = -25.0;
    private friction = 8.0;
    private airFriction = 2.0;
    private mouseSensitivity = 0.002;
    private characterHeight = 1.8;

    public update(deltaTime: number): void {
        this.updateMovement(deltaTime);
        this.updateCamera();
    }

    private initInput(): void {
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
        document.addEventListener('keyup', (e) => this.onKeyUp(e));
        window.addEventListener('blur', () => this.resetControls());

        document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
        document.addEventListener('pointerlockerror', () => {
            console.error('Pointer lock error');
        });

        this.domElement.addEventListener('click', () => {
            if (!this.isPointerLocked) {
                this.domElement.requestPointerLock();
            }
        });

        this.domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    }

    private onKeyDown(event: KeyboardEvent): void {
        switch (event.code) {
            case 'KeyW': this.controls.forward = true; break;
            case 'KeyS': this.controls.backward = true; break;
            case 'KeyA': this.controls.left = true; break;
            case 'KeyD': this.controls.right = true; break;
            case 'Space':
                if (this.controls.flightMode) this.controls.up = true;
                else if (this.isOnGround) {
                    this.velocity.y = this.jumpForce;
                    this.isOnGround = false;
                }
                event.preventDefault();
                break;
            case 'KeyC':
                if (this.controls.flightMode) this.controls.down = true;
                break;
            case 'KeyF':
                this.controls.flightMode = !this.controls.flightMode;
                if (!this.controls.flightMode) {
                    this.velocity.y = 0;
                    this.position.y = Math.max(this.groundHeight + this.characterHeight, this.position.y);
                }
                break;
            case 'KeyE':
                // Toggle sign placing mode
                this.placingSign = !this.placingSign;
                break;
            case 'Escape':
                if (this.isPointerLocked) document.exitPointerLock();
                break;
        }
    }

    private onKeyUp(event: KeyboardEvent): void {
        switch (event.code) {
            case 'KeyW': this.controls.forward = false; break;
            case 'KeyS': this.controls.backward = false; break;
            case 'KeyA': this.controls.left = false; break;
            case 'KeyD': this.controls.right = false; break;
            case 'Space': this.controls.up = false; break;
            case 'KeyC': this.controls.down = false; break;
        }
    }

    private onPointerLockChange(): void {
        this.isPointerLocked = document.pointerLockElement === this.domElement;
    }

    public resetControls(): void {
        this.controls.forward = false;
        this.controls.backward = false;
        this.controls.left = false;
        this.controls.right = false;
        this.controls.up = false;
        this.controls.down = false;
    }

    private onMouseMove(event: MouseEvent): void {
        if (!this.isPointerLocked) return;

        const movementX = event.movementX || 0;
        const movementY = event.movementY || 0;

        this.yaw -= movementX * this.mouseSensitivity;
        this.pitch -= movementY * this.mouseSensitivity;

        this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
    }

    private updateMovement(deltaTime: number): void {
        const direction = new THREE.Vector3();

        if (this.controls.forward) direction.z -= 1;
        if (this.controls.backward) direction.z += 1;
        if (this.controls.left) direction.x -= 1;
        if (this.controls.right) direction.x += 1;

        if (direction.lengthSq() > 0) direction.normalize();

        const rotatedDirection = direction.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);

        const targetVelocity = rotatedDirection.multiplyScalar(this.moveSpeed);
        const frictionForce = this.isOnGround ? this.friction : this.airFriction;

        this.velocity.x = this.lerp(this.velocity.x, targetVelocity.x, frictionForce * deltaTime);
        this.velocity.z = this.lerp(this.velocity.z, targetVelocity.z, frictionForce * deltaTime);

        if (this.controls.flightMode) {
            let vertical = 0;
            if (this.controls.up) vertical += 1;
            if (this.controls.down) vertical -= 1;

            const targetY = vertical * this.moveSpeed;
            this.velocity.y = this.lerp(this.velocity.y, targetY, frictionForce * deltaTime);
        } else {
            this.velocity.y += this.gravity * deltaTime;

            const groundY = this.groundHeight + this.characterHeight;
            if (this.position.y <= groundY && this.velocity.y <= 0) {
                this.position.y = groundY;
                this.velocity.y = 0;
                this.isOnGround = true;
            } else {
                this.isOnGround = false;
            }
        }

        this.position.addScaledVector(this.velocity, deltaTime);
    }

    private updateCamera(): void {
        this.camera.position.copy(this.position);
        this.camera.position.y += this.characterHeight * 0.9;
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.yaw;
        this.camera.rotation.x = this.pitch;
    }

    private lerp(start: number, end: number, factor: number): number {
        return start + (end - start) * Math.min(factor, 1);
    }
}
