import * as THREE from 'three';
import { CodeObjectManager } from './CodeObjectManager';

export class InteractionController {
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private mouse: THREE.Vector2 = new THREE.Vector2();

    constructor(
        private camera: THREE.Camera,
        private domElement: HTMLElement,
        private objects: CodeObjectManager,
        private vscode: any
    ) {
        domElement.addEventListener('click', (e) => this.onClick(e));
        domElement.addEventListener('dblclick', () => this.onDoubleClick());
        domElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
    }

    private onClick(event: MouseEvent): void {
        if (document.pointerLockElement !== this.domElement) {
            this.domElement.requestPointerLock();
            return;
        }

        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.objects.getObjectMeshes());

        if (intersects.length > 0) {
            const mesh = intersects[0].object as THREE.Mesh;
            const obj = this.objects.findByMesh(mesh);
            if (obj) {
                this.objects.selectObject(obj);
                this.showDependencies(obj.id);

                // Notify VSCode extension
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
        } else {
            this.objects.deselectObject();
            this.hideDependencies();
        }
    }

    private onDoubleClick(): void {
        const selected = this.objects.getSelectedObject?.() || this.objects['selectedObject'];
        if (selected) {
            // Open both the code file and description file in VSCode
            this.vscode.postMessage({
                type: 'openFiles',
                data: {
                    codeFile: selected.filePath,
                    descriptionFile: selected.filePath + '.description.md' // convention: description next to code file
                }
            });
        }
    }

    private onMouseMove(event: MouseEvent): void {
        // This controller does not handle rotation; CharacterController handles that
    }

    private showDependencies(objectId: string): void {
        this.objects.showDependenciesForObject(objectId);
    }

    private hideDependencies(): void {
        this.objects.showAllDependencies();
    }
}
