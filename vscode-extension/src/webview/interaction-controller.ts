import * as THREE from 'three';
import { CodeObjectManager } from './code-object-manager';
import { SelectionManager } from './selection-manager';
import { CodeEntityDTO } from './types'; // If needed, but code seems to not import it?
// Checking file content from Step 140:
// It imports THREE and CodeObjectManager.
// It DOES NOT import CodeObject.
// So no changes needed for imports?
// Wait, Step 140 showed:
// 1: import * as THREE from 'three';
// 2: import { CodeObjectManager } from './code-object-manager';
// No CodeObject import.
// So InteractionController might be fine?
// But it accesses `obj.type`, `obj.filePath` etc. `VisualObject` has these.
// So InteractionController is fine.

// Actually, `test-bridge.ts` ?
// Step 141:
// It imports SceneManager, CodeObjectManager, CharacterController.
// Does it import CodeObject? No.
// It defines SceneSnapshot.
// It iterates objects.
// `scene.traverse`... check `object.userData.visualObject`.
// visualObject is `VisualObject`.
// So it seems I don't need to update `interaction-controller.ts` or `test-bridge.ts` if they don't import `CodeObject` explicitly.
// But wait, `CodeObjectManager.getFocusedObject` returns `CodeEntityDTO | null`.
// Does InteractionController use that?
// Line 209: `const currentSelected = this.objects.getSelectedObject();`
// `getSelectedObject` now returns `CodeEntityDTO`.
// `targetObj` is `VisualObject` (from `findByMesh`).
// Comparison `targetObj !== currentSelected` might fail if `currentSelected` is a DTO copy?
// `toCodeObject()` returns `this` in `VisualObject` (Step 131: `return this;`).
// So they are the same instance. Comparison is safe.

// So Interaction Controller is safe.
// Test Bridge?
// `getSceneState` uses `visualObject` from `userData`.
// Safe.

// So only `dependency-manager` needed updates? 
// And `world-renderer.ts`?
// Let's check `world-renderer.ts` imports.


export class InteractionController {
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private crosshair: HTMLDivElement;

    constructor(
        private camera: THREE.Camera,
        private domElement: HTMLElement,
        private objects: CodeObjectManager,
        private selectionManager: SelectionManager,
        private vscode: any,
        private character: any // reference to CharacterController
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

        // Place sign if mode is active
        if (this.character['placingSign']) {
            const cameraDir = new THREE.Vector3();
            this.camera.getWorldDirection(cameraDir);

            const placePos = new THREE.Vector3().copy(this.camera.position).add(cameraDir.multiplyScalar(3));

            this.vscode.postMessage({
                type: 'addSignAtPosition',
                data: { position: { x: placePos.x, y: placePos.y, z: placePos.z } }
            });

            this.character['placingSign'] = false;
            return;
        }

        // Raycast at center to select object
        this.mouse.set(0, 0);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(
            this.objects.getObjectMeshes(),
            true
        );

        if (intersects.length === 0) {
            this.selectionManager.deselectObject();
            this.resetDependencies();
            return;
        }

        const mesh = intersects[0].object as THREE.Mesh;
        const obj = this.objects.findByMesh(mesh);

        if (!obj) { return; }

        // ───────── SELECT AND HIGHLIGHT ─────────
        this.selectionManager.selectObject(obj);
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
        // ───────── OPEN FILE UNDER CURSOR ─────────
        this.mouse.set(0, 0); // center of screen
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(
            this.objects.getObjectMeshes(),
            true
        );

        if (intersects.length === 0) { return; }

        const mesh = intersects[0].object as THREE.Mesh;
        const obj = this.objects.findByMesh(mesh);

        if (!obj) { return; }

        // Open the file without affecting selection or highlighting
        this.vscode.postMessage({
            type: 'openFiles',
            data: {
                codeFile: obj.filePath
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

    // ────────────────────────────────────────────────
    // Focus / Look-At Logic
    // ────────────────────────────────────────────────

    private lastFocusTime = 0;
    private FOCUS_COOLDOWN = 200; // ms

    public update(): void {
        // Raycast from center to find "looked at" object
        this.mouse.set(0, 0);
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(
            this.objects.getObjectMeshes(),
            true
        );

        let targetObj: any | null = null;
        if (intersects.length > 0) {
            const mesh = intersects[0].object as THREE.Mesh;
            targetObj = this.objects.findByMesh(mesh);
        }

        const currentSelected = this.selectionManager.getSelectedVisualObject();

        if (targetObj !== currentSelected) {
            this.selectionManager.setFocusedObject(targetObj);

            // Debounce message sending
            const now = Date.now();
            if (now - this.lastFocusTime > this.FOCUS_COOLDOWN) {
                this.lastFocusTime = now;
                if (targetObj) {
                    // Sanitize metadata to avoid DataCloneError
                    const safeMetadata = targetObj.metadata ? JSON.parse(JSON.stringify(targetObj.metadata)) : {};

                    try {
                        this.vscode.postMessage({
                            type: 'objectFocused',
                            data: {
                                id: targetObj.id,
                                type: targetObj.type,
                                filePath: targetObj.filePath,
                                metadata: safeMetadata
                            }
                        });
                    } catch (err) {
                        console.error('Failed to send objectFocused message:', err);
                    }
                }
            }
        }
    }
}
