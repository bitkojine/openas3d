import * as THREE from 'three';
import { CodeObjectManager } from './CodeObjectManager';

export class InteractionController {
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private crosshair: HTMLDivElement;

    constructor(
        private camera: THREE.Camera,
        private domElement: HTMLElement,
        private objects: CodeObjectManager,
        private vscode: any
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
        document.removeEventListener(
            'pointerlockchange',
            this.onPointerLockChange
        );

        this.crosshair.remove();
    }

    // ────────────────────────────────────────────────
    // Pointer + Interaction
    // ────────────────────────────────────────────────

    private onPointerDown(_event: PointerEvent): void {
        // Acquire pointer lock on first interaction
        if (document.pointerLockElement !== this.domElement) {
            this.domElement.requestPointerLock();
            return;
        }

        // Always raycast from screen center when locked
        this.mouse.set(0, 0);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(
            this.objects.getObjectMeshes(),
            true
        );

        if (intersects.length === 0) {
            this.objects.deselectObject();
            this.resetDependencies();
            return;
        }

        const mesh = intersects[0].object as THREE.Mesh;
        const obj = this.objects.findByMesh(mesh);

        if (!obj) return;

        this.objects.selectObject(obj);
        this.showDependencies(obj.id);

        this.vscode.postMessage({
            type: 'objectSelected',
            data: {
                id: obj.id,
                type: obj.type,
                filePath: obj.filePath,
                metadata: obj.metadata,
                description: obj.description
            }
        });
    }

    private onDoubleClick(): void {
        const selected = this.objects.getSelectedObject?.();
        if (!selected) return;

        this.vscode.postMessage({
            type: 'openFiles',
            data: {
                codeFile: selected.filePath
            }
        });
    }

    private onMouseMove(_event: MouseEvent): void {
        // Camera rotation handled elsewhere (CharacterController)
    }

    // ────────────────────────────────────────────────
    // Crosshair
    // ────────────────────────────────────────────────

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

    // ────────────────────────────────────────────────
    // Dependency Visualization
    // ────────────────────────────────────────────────

    private showDependencies(objectId: string): void {
        this.objects.showDependenciesForObject(objectId);
    }

    private resetDependencies(): void {
        this.objects.showAllDependencies();
    }
}
