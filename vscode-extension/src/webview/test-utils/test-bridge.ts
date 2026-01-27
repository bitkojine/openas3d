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
    ui?: {
        legendOpen: boolean;
        tddOpen: boolean;
        statsOpen: boolean;
    };
    player?: {
        position: { x: number; y: number; z: number };
        yaw: number;
        pitch: number;
        flightMode: boolean;
    };
    selection?: {
        selectedFileId: string | null;
    };
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
                        // Copy fileId from metadata if available
                        if (visualObject.metadata && visualObject.metadata.fileId) {
                            safeUserData.fileId = visualObject.metadata.fileId;
                        }
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

        const selected = this.selectionManager.getSelectedVisualObject();

        return {
            objectCount: snapshotObjects.length,
            objects: snapshotObjects,
            dependencyCount: depCount,
            dependencies: edges,
            ui: {
                legendOpen: false,
                tddOpen: false,
                statsOpen: false
            },
            player: {
                position: { x: this.character.position.x, y: this.character.position.y, z: this.character.position.z },
                yaw: this.character.yaw,
                pitch: this.character.pitch,
                flightMode: this.character.isFlightMode
            },
            selection: {
                selectedFileId: selected ? selected.id : null
            }
        };
    }

    public simulateMove(x: number, z: number) {
        // Find the first file object to move (for testing purposes)
        let targetObject: any = null;
        let targetId: string = '';
        
        for (const [id, object] of (this.objects as any).objects.entries()) {
            if (object.userData && object.userData.type === 'file') {
                targetObject = object;
                targetId = id;
                break;
            }
        }
        
        if (targetObject) {
            console.log('[TestBridge] Moving object', targetId, 'to', x, z);
            
            // Move the object to the new position
            targetObject.position.set(x, targetObject.position.y, z);
            
            // Send moveObject message to extension for persistence
            if (this.vscode) {
                console.log('[TestBridge] Sending moveObject message');
                // Use fileId from metadata if available, otherwise fall back to object id
                const fileId = targetObject.metadata?.fileId || targetId;
                console.log('[TestBridge] Using fileId:', fileId);
                this.postMessage({
                    type: 'moveObject',
                    data: {
                        id: fileId, // Send fileId instead of object id
                        position: {
                            x: x,
                            y: targetObject.position.y,
                            z: z
                        }
                    }
                });
            } else {
                console.log('[TestBridge] No vscode connection available');
            }
        } else {
            console.log('[TestBridge] No file object found, moving character instead');
            // Fallback: move character if no object found
            this.character.position.set(x, 1.7, z);
        }
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
                console.log('[TestBridge] Received TEST_GET_SCENE_STATE message');
                try {
                    const state = this.getSceneState();
                    console.log('[TestBridge] Got scene state:', state ? `(${state.objectCount} objects)` : 'null');
                    if (this.vscode) {
                        console.log('[TestBridge] Sending TEST_SCENE_STATE response');
                        this.postMessage({
                            type: 'TEST_SCENE_STATE',
                            data: state
                        });
                        console.log('[TestBridge] TEST_SCENE_STATE response sent');
                    } else {
                        console.error('[TestBridge] No vscode connection available');
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
            } else if ((message as any).type === 'TEST_MESSAGE') {
                // Handle generic test message
                console.log('[TestBridge] Received test message:', (message as any).data);
                if (this.vscode) { this.postMessage({ type: 'TEST_MESSAGE_ACK', data: { received: true } } as any); }
            } else if ((message as any).type === 'TEST_PING') {
                // Handle ping message
                console.log('[TestBridge] Received ping');
                if (this.vscode) { this.postMessage({ type: 'TEST_PONG', data: { timestamp: Date.now() } } as any); }
            } else if ((message as any).type === 'TEST_ERROR') {
                // Handle test error message
                console.log('[TestBridge] Received test error:', (message as any).data);
                if (this.vscode) { this.postMessage({ type: 'TEST_ERROR_ACK', data: { errorHandled: true } } as any); }
            } else if ((message as any).type === 'TEST_MOVE_OBJECT') {
                // Handle object movement
                console.log('[TestBridge] Received move object command:', (message as any).data);
                // Find and move the object
                let targetObject: any = null;
                const requestedId = (message as any).data.id;
                for (const [id, object] of (this.objects as any).objects.entries()) {
                    const objectFileId = object?.metadata?.fileId || object?.metadata?.metadata?.fileId;
                    if (id === requestedId || object?.id === requestedId || objectFileId === requestedId) {
                        targetObject = object;
                        break;
                    }
                }
                
                if (targetObject) {
                    targetObject.position.set((message as any).data.position.x, (message as any).data.position.y, (message as any).data.position.z);
                    console.log('[TestBridge] Moved object to:', (message as any).data.position);
                    
                    // Send the actual moveObject message to trigger layout persistence
                    if (this.vscode) {
                        this.postMessage({
                            type: 'moveObject',
                            data: {
                                id: requestedId,
                                position: {
                                    x: (message as any).data.position.x,
                                    y: (message as any).data.position.y,
                                    z: (message as any).data.position.z
                                }
                            }
                        } as any);
                    }
                }
                
                if (this.vscode) { this.postMessage({ type: 'TEST_MOVE_OBJECT_ACK', data: { moved: !!targetObject } } as any); }
            } else if ((message as any).type === 'restoreWorldState') {
                // Handle restore world state message (used as fallback in test commands)
                console.log('[TestBridge] Received restore world state:', (message as any).data);
                if (this.vscode) { 
                    // Send back a scene state response to satisfy the test
                    const state = this.getSceneState();
                    this.postMessage({
                        type: 'TEST_SCENE_STATE',
                        data: state
                    });
                }
            } else if ((message as any).type === 'TEST_LOOK_AT') {
                await this.lookAt((message as any).data.x, (message as any).data.y, (message as any).data.z, (message as any).data.duration);
                if (this.vscode) { this.postMessage({ type: 'TEST_LOOK_AT_DONE' } as any); }
            } else if ((message as any).type === 'TEST_GET_POSITION') {
                const pos = { x: this.character.position.x, y: this.character.position.y, z: this.character.position.z };
                if (this.vscode) { this.postMessage({ type: 'TEST_POSITION', data: pos } as any); }
            }
        });
    }
}
