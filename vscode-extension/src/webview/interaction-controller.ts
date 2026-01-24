import * as THREE from 'three';
import { CodeObjectManager } from './code-object-manager';
import { SelectionManager } from './selection-manager';
import { DependencyManager } from './dependency-manager';
import { WebviewMessage } from '../shared/messages';

import { DraggableObjectController } from './controllers/draggable-controller';
import { ContextMenu } from './ui/context-menu';
import { ContextMenuRegistry } from './services/context-menu-registry';

export class InteractionController {
    private raycaster = new THREE.Raycaster();
    private mouse = new THREE.Vector2();
    private crosshair: HTMLDivElement;
    private draggable: DraggableObjectController;
    private contextMenu: ContextMenu;

    constructor(
        private camera: THREE.Camera,
        private domElement: HTMLElement,
        private objects: CodeObjectManager,
        private selectionManager: SelectionManager,
        private dependencyManager: DependencyManager,
        private vscode: any,
        private character: any // reference to CharacterController
    ) {
        this.draggable = new DraggableObjectController(
            objects,
            camera,
            (id, pos) => this.postMessage({
                type: 'moveObject',
                data: { id, position: { x: pos.x, y: pos.y, z: pos.z } }
            })
        );

        this.contextMenu = new ContextMenu();

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);
        this.onDoubleClick = this.onDoubleClick.bind(this);
        this.onMouseMove = this.onMouseMove.bind(this);
        this.onPointerLockChange = this.onPointerLockChange.bind(this);
        this.onContextMenu = this.onContextMenu.bind(this);

        domElement.addEventListener('pointerdown', this.onPointerDown);
        domElement.addEventListener('pointerup', this.onPointerUp);
        domElement.addEventListener('dblclick', this.onDoubleClick);
        domElement.addEventListener('mousemove', this.onMouseMove);
        domElement.addEventListener('contextmenu', this.onContextMenu);
        document.addEventListener('pointerlockchange', this.onPointerLockChange);

        this.crosshair = this.createCrosshair();
        this.updateCrosshairVisibility();
    }

    private postMessage(message: WebviewMessage): void {
        this.vscode.postMessage(message);
    }

    dispose(): void {
        this.domElement.removeEventListener('pointerdown', this.onPointerDown);
        this.domElement.removeEventListener('pointerup', this.onPointerUp);
        this.domElement.removeEventListener('dblclick', this.onDoubleClick);
        this.domElement.removeEventListener('mousemove', this.onMouseMove);
        this.domElement.removeEventListener('contextmenu', this.onContextMenu);
        document.removeEventListener(
            'pointerlockchange',
            this.onPointerLockChange
        );

        this.crosshair.remove();
        this.contextMenu.hide();
    }

    // ────────────────────────────────────────────────
    // Pointer + Interaction
    // ────────────────────────────────────────────────

    private onContextMenu(event: MouseEvent): void {
        event.preventDefault();

        // If pointer is locked, we can't easily show a menu at the cursor
        // because the cursor is hidden/fixed.
        // We either unlock pointer OR show menu at center.
        // VSCode users usually expect right-click to show a menu.

        if (document.pointerLockElement === this.domElement) {
            document.exitPointerLock();
        }

        this.mouse.set(0, 0); // center
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(
            this.objects.getObjectMeshes(),
            true
        );

        if (intersects.length > 0) {
            const mesh = intersects[0].object as THREE.Mesh;
            const obj = this.objects.findByMesh(mesh);

            if (obj) {
                const items = ContextMenuRegistry.getInstance().getMenuItems(obj);
                if (items.length > 0) {
                    this.contextMenu.show(event.clientX, event.clientY, items, obj);
                }
            }
        }
    }

    private onPointerDown(event: PointerEvent): void {
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

            this.postMessage({
                type: 'addSignAtPosition',
                data: { position: { x: placePos.x, y: placePos.y, z: placePos.z } }
            });

            this.character['placingSign'] = false;
            return;
        }

        // Raycast at center
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

        // Start Drag ONLY if Shift is held
        if (event.shiftKey && this.draggable.startDrag(obj, this.raycaster)) {
            // If we started dragging, select it too
            this.selectionManager.selectObject(obj);
            return;
        }

        // ───────── SELECT AND HIGHLIGHT ─────────
        this.selectionManager.selectObject(obj);
        this.showDependencies(obj.id);

        this.postMessage({
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

    private onPointerUp(_event: PointerEvent): void {
        if (this.draggable.getIsDragging()) {
            this.draggable.endDrag();
        }
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
        // Open the file without affecting selection or highlighting
        this.postMessage({
            type: 'openFiles',
            data: {
                codeFile: obj.filePath
            }
        });
    }

    private onMouseMove(_event: MouseEvent): void {
        // Camera rotation handled elsewhere (CharacterController)
        if (this.draggable.getIsDragging()) {
            this.mouse.set(0, 0);
            this.raycaster.setFromCamera(this.mouse, this.camera);
            this.draggable.update(this.raycaster);
        }
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
        this.dependencyManager.showForObject(objectId);
    }

    private resetDependencies(): void {
        this.dependencyManager.showAll();
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
                        this.postMessage({
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
