import * as THREE from 'three';
import { SceneManager } from '../scene-manager';
import { CodeObjectManager } from '../code-object-manager';
import { CharacterController } from '../character-controller';
import { SelectionManager } from '../selection-manager';
import { DependencyManager } from '../dependency-manager';
import { WebviewMessage, ExtensionMessage } from '../../shared/messages';

export interface SceneSnapshot {
    objectCount: number;
    objects: Array<{
        id: string; // derived from user data or uuid
        type: string;
        position: { x: number; y: number; z: number };
        userData: any;
    }>;
    dependencyCount: number;
    dependencies: Array<{ source: string; target: string }>;
}

export class TestBridge {
    private sceneManager: SceneManager;
    private objects: CodeObjectManager;
    private selectionManager: SelectionManager;
    private dependencyManager: DependencyManager;
    private character: CharacterController;
    private vscode: any;

    constructor(
        sceneManager: SceneManager,
        objects: CodeObjectManager,
        selectionManager: SelectionManager,
        dependencyManager: DependencyManager,
        character: CharacterController,
        vscodeApi?: any
    ) {
        this.sceneManager = sceneManager;
        this.objects = objects;
        this.selectionManager = selectionManager;
        this.dependencyManager = dependencyManager;
        this.character = character;
        this.vscode = vscodeApi;
        this.exposeToWindow();
    }

    // ... methods


    public getSceneState(): SceneSnapshot {
        const scene = this.sceneManager.scene;
        const snapshotObjects: SceneSnapshot['objects'] = [];

        scene.traverse((object) => {
            if (object instanceof THREE.Mesh || object instanceof THREE.Group) {
                // Check for direct userData OR visualObject wrapper
                const id = object.userData.id || (object.userData.visualObject && object.userData.visualObject.id);
                const type = object.userData.type || (object.userData.visualObject && object.userData.visualObject.type);

                if (id) {
                    const safeUserData = { ...object.userData };
                    const visualObject = object.userData.visualObject;

                    if (visualObject) {
                        // Copy relevant metadata from the wrapper to the snapshot
                        safeUserData.filePath = visualObject.filePath;
                        safeUserData.description = visualObject.description;
                        safeUserData.type = visualObject.type;
                    }
                    delete safeUserData.visualObject; // Remove circular/complex reference

                    snapshotObjects.push({
                        id: id,
                        type: type || 'unknown',
                        position: {
                            x: parseFloat(object.position.x.toFixed(2)),
                            y: parseFloat(object.position.y.toFixed(2)),
                            z: parseFloat(object.position.z.toFixed(2))
                        },
                        userData: safeUserData
                    });
                }
            }
        });

        const depCount = this.dependencyManager.getDependencyCount();
        const edges: Array<{ source: string, target: string }> = [];

        for (const dep of this.dependencyManager.getAll()) {
            edges.push({ source: dep.source, target: dep.target });
        }

        return {
            objectCount: snapshotObjects.length,
            objects: snapshotObjects,
            dependencyCount: depCount,
            dependencies: edges
        };
    }

    public simulateMove(x: number, z: number) {
        // Teleport behavior for testing
        // Set camera position to represent character movement
        // Since we have the character, we could set its position, but this method implies simulating input or instant move?
        // The original code set camera position directly which is weird if we have a character controller.
        // Let's assume we want to move the character.
        this.character.position.set(x, 1.7, z); // 1.7m eye height approximation or just y
        // Sync camera? CharacterController update does that.
    }

    public simulateKeyDown(code: string) {
        document.dispatchEvent(new KeyboardEvent('keydown', { code }));
    }

    public simulateKeyUp(code: string) {
        document.dispatchEvent(new KeyboardEvent('keyup', { code }));
    }

    public simulatePointerDown() {
        // Mock pointer lock for interaction controller
        Object.defineProperty(document, 'pointerLockElement', {
            get: () => this.sceneManager.renderer.domElement,
            configurable: true
        });

        this.sceneManager.renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            view: window
        }));
    }

    public teleport(x: number, y: number, z: number) {
        this.character.position.set(x, y, z);
    }

    public async lookAt(x: number, y: number, z: number, duration: number = 0): Promise<void> {
        // Calculate yaw/pitch to face target
        const camPos = this.character.position.clone();
        camPos.y += 1.6; // Eye height

        const target = new THREE.Vector3(x, y, z);
        const dir = target.sub(camPos).normalize();

        // Yaw (rotation around Y)
        const targetYaw = Math.atan2(-dir.x, -dir.z);

        // Pitch (rotation around X)
        const targetPitch = Math.asin(dir.y);

        // Instant update
        if (duration <= 0) {
            this.character.yaw = targetYaw;
            this.character.pitch = targetPitch;
            return Promise.resolve();
        }

        // Smooth animation
        return new Promise<void>((resolve) => {
            const startYaw = this.character.yaw || 0;
            const startPitch = this.character.pitch || 0;
            const startTime = performance.now();

            // Normalize angles for shortest path interpolation
            let diffYaw = targetYaw - startYaw;
            while (diffYaw < -Math.PI) { diffYaw += Math.PI * 2; }
            while (diffYaw > Math.PI) { diffYaw -= Math.PI * 2; }
            const finalYaw = startYaw + diffYaw;

            const animate = (time: number) => {
                const elapsed = time - startTime;
                const progress = Math.min(elapsed / duration, 1.0);

                // Ease out cubic
                const ease = 1 - Math.pow(1 - progress, 3);

                this.character.yaw = startYaw + (finalYaw - startYaw) * ease;
                this.character.pitch = startPitch + (targetPitch - startPitch) * ease;

                if (progress < 1.0) {
                    requestAnimationFrame(animate);
                } else {
                    resolve();
                }
            };
            requestAnimationFrame(animate);
        });
    }

    public selectObject(id: string) {
        // Find visual object in CodeObjectManager
        let visualObject: any = null;
        for (const obj of (this.objects as any).objects.values()) {
            if (obj.id === id) {
                visualObject = obj;
                break;
            }
        }

        if (!visualObject) {
            console.error(`TestBridge: Object ${id} not found`);
            return;
        }

        // 2. Visual Selection
        this.selectionManager.selectObject(visualObject);

        // 3. Message Passing (Simulate interaction)
        if (this.vscode) {
            this.postMessage({
                type: 'openFiles',
                data: {
                    codeFile: visualObject.filePath
                }
            });
        }
    }

    private postMessage(message: WebviewMessage): void {
        this.vscode?.postMessage(message);
    }

    private exposeToWindow() {
        (window as any).__OPENAS3D_TEST_BRIDGE__ = {
            getSceneState: () => this.getSceneState(),
            simulateSelection: (id: string) => this.selectObject(id),
            simulateMove: (x: number, z: number) => this.simulateMove(x, z),
            simulateKeyDown: (code: string) => this.simulateKeyDown(code),
            simulateKeyUp: (code: string) => this.simulateKeyUp(code),
            simulatePointerDown: () => this.simulatePointerDown(),
            teleport: (x: number, y: number, z: number) => this.teleport(x, y, z),
            lookAt: (x: number, y: number, z: number, duration?: number) => this.lookAt(x, y, z, duration),
            getCharacterPosition: () => {
                return { x: this.character.position.x, y: this.character.position.y, z: this.character.position.z };
            }
        };

        // Listen for messages from the extension
        window.addEventListener('message', async (event: MessageEvent<ExtensionMessage>) => {
            const message = event.data;

            if (message.type === 'TEST_GET_SCENE_STATE') {
                try {
                    const state = this.getSceneState();
                    if (this.vscode) {
                        this.postMessage({
                            type: 'TEST_SCENE_STATE',
                            data: state
                        });
                    }
                } catch (e: any) {
                    console.error('[TestBridge] Error getting scene state:', e);
                }
            } else if (message.type === 'TEST_SIMULATE_SELECTION') {
                this.selectObject(message.data.id);
                if (this.vscode) { this.postMessage({ type: 'TEST_SELECTION_DONE' }); }
            } else if (message.type === 'TEST_SIMULATE_MOVE') {
                this.simulateMove(message.data.x, message.data.z);
                if (this.vscode) { this.postMessage({ type: 'TEST_MOVE_DONE' }); }
            } else if (message.type === 'TEST_SIMULATE_INPUT') {
                if (message.data.kind === 'keydown' && message.data.code) { this.simulateKeyDown(message.data.code); }
                if (message.data.kind === 'keyup' && message.data.code) { this.simulateKeyUp(message.data.code); }
                if (message.data.kind === 'pointerdown') { this.simulatePointerDown(); }

                if (this.vscode) { this.postMessage({ type: 'TEST_INPUT_DONE' }); }
            } else if (message.type === 'TEST_TELEPORT') {
                this.teleport(message.data.x, message.data.y, message.data.z);
                if (this.vscode) { this.postMessage({ type: 'TEST_TELEPORT_DONE' }); }
            } else if (message.type === 'TEST_LOOK_AT') {
                await this.lookAt(message.data.x, message.data.y, message.data.z, message.data.duration);
                if (this.vscode) { this.postMessage({ type: 'TEST_LOOK_AT_DONE' }); }
            } else if (message.type === 'TEST_GET_POSITION') {
                const pos = { x: this.character.position.x, y: this.character.position.y, z: this.character.position.z };
                if (this.vscode) { this.postMessage({ type: 'TEST_POSITION', data: pos }); }
            }
        });
    }
}
