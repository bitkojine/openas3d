import * as THREE from 'three';
import { CodeObjectManager } from './code-object-manager';
import { WebviewMessaging } from './messaging-webview';

export class InteractionController {
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private crosshair: HTMLDivElement;

    constructor(
        private camera: THREE.Camera,
        private domElement: HTMLElement,
        private objects: CodeObjectManager,
        private messaging: WebviewMessaging,
        private character: any // CharacterController
    ) {
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onDoubleClick = this.onDoubleClick.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onPointerLockChange = this.onPointerLockChange.bind(this);

        domElement.addEventListener('pointerdown', this.onPointerDown);
        domElement.addEventListener('dblclick', this.onDoubleClick);
        domElement.addEventListener('mousemove', this.onMouseMove);
        document.addEventListener('pointerlockchange', this.onPointerLockChange);

        this.crosshair = this.createCrosshair();
        this.updateCrosshairVisibility();
    }

    dispose(): void {
        this.domElement.removeEventListener('pointerdown', this.onPointerDown);
        this.domElement.removeEventListener('dblclick', this.onDoubleClick);
        this.domElement.removeEventListener('mousemove', this.onMouseMove);
        document.removeEventListener('pointerlockchange', this.onPointerLockChange);
        this.crosshair.remove();
    }

    // ────────────────────────────────
    // Pointer / Click Handling
    // ────────────────────────────────

    private onPointerDown(_event: PointerEvent): void {
        // Acquire pointer lock
        if (document.pointerLockElement !== this.domElement) {
            this.domElement.requestPointerLock();
            return;
        }

        // Place sign if mode is active
        if (this.character['placingSign']) {
            const cameraDir = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDir);

            const placePos = new THREE.Vector3().copy(this.camera.position).add(cameraDir.multiplyScalar(3));

            this.messaging.send('addSignAtPosition', { position: { x: placePos.x, y: placePos.y, z: placePos.z } });

            this.character['placingSign'] = false;
            return;
        }

        // Raycast at center to select object
        this.mouse.set(0, 0);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.objects.getObjectMeshes(), true);
        if (intersects.length === 0) {
            this.objects.deselectObject();
            this.resetDependencies();
            return;
        }

        const mesh = intersects[0].object as THREE.Mesh;
        const obj = this.objects.findByMesh(mesh);
        if (!obj) return;

        // Select and highlight
        this.objects.selectObject(obj);
        this.showDependencies(obj.id);

        // Send selection to extension
        this.messaging.send('objectSelected', {
            id: obj.id,
            type: obj.type,
            filePath: obj.filePath,
            metadata: obj.metadata,
            description: obj.description
        });
    }

    private onDoubleClick(): void {
        // Raycast at center
        this.mouse.set(0, 0);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.objects.getObjectMeshes(), true);
        if (intersects.length === 0) return;

        const mesh = intersects[0].object as THREE.Mesh;
        const obj = this.objects.findByMesh(mesh);
        if (!obj) return;

        // Open file without affecting selection
        this.messaging.send('openFiles', {
            codeFile: obj.filePath
        });
    }

    private onMouseMove(_event: MouseEvent): void {
        // Camera rotation handled elsewhere (CharacterController)
    }

    // ────────────────────────────────
    // Crosshair
    // ────────────────────────────────

    private createCrosshair(): HTMLDivElement {
        const crosshair = document.createElement('div');
        crosshair.style.position = 'fixed';
        crosshair.style.left = '50%';
        crosshair.style.top = '50%';
        crosshair.style.width = '12px';
        crosshair.style.height = '12px';
        crosshair.style.marginLeft = '-6px';
        crosshair.style.marginTop = '-6px';
        crosshair.style.pointerEvents = 'none';
        crosshair.style.zIndex = '9999';
        crosshair.style.display = 'none';
        crosshair.style.background = `
            linear-gradient(#fff, #fff),
            linear-gradient(#fff, #fff)
        `;
        crosshair.style.backgroundSize = '2px 12px, 12px 2px';
        crosshair.style.backgroundPosition = 'center';
        crosshair.style.backgroundRepeat = 'no-repeat';
        document.body.appendChild(crosshair);
        return crosshair;
    }

    private onPointerLockChange(): void {
        this.updateCrosshairVisibility();
    }

    private updateCrosshairVisibility(): void {
        const isLocked = document.pointerLockElement === this.domElement;
        this.crosshair.style.display = isLocked ? 'block' : 'none';
    }

    // ────────────────────────────────
    // Dependency Visualization
    // ────────────────────────────────

    private showDependencies(objectId: string): void {
        this.objects.showDependenciesForObject(objectId);
    }

    private resetDependencies(): void {
        this.objects.showAllDependencies();
    }
}
