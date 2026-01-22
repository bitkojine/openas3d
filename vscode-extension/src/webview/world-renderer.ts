// Declare the global VSCode API for the webview environment
declare const acquireVsCodeApi: () => {
    postMessage: (msg: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

import { SceneManager } from './scene-manager';
import { CharacterController } from './character-controller';
import { CodeObjectManager } from './code-object-manager';
import { InteractionController } from './interaction-controller';
import { StatsUI } from './stats-ui';
import { TestBridge } from './test-utils/test-bridge';
import { addZoneVisuals, removeZoneVisuals, ZoneBounds } from './zone-visuals';

export class WorldRenderer {
    private sceneManager: SceneManager;
    private character: CharacterController;
    private objects: CodeObjectManager;
    private interaction: InteractionController;
    private ui: StatsUI;

    private vscode: any;

    private lastTime: number = 0;

    constructor(vscodeApi: any) {
        this.vscode = vscodeApi;
        const container = document.getElementById('renderer')!;
        const statsEl = document.getElementById('stats')!;
        const loadingEl = document.getElementById('loading')!;

        this.sceneManager = new SceneManager(container, this.vscode);

        this.character = new CharacterController(
            this.sceneManager.camera,
            this.sceneManager.renderer.domElement,
            8.0,   // moveSpeed
            2.0,   // sprintMultiplier
            0.5    // groundHeight
        );

        // Add placingSign property for sign mode
        (this.character as any).placingSign = false;

        this.objects = new CodeObjectManager(this.sceneManager.scene);
        this.ui = new StatsUI(statsEl, loadingEl);

        this.interaction = new InteractionController(
            this.sceneManager.camera,
            this.sceneManager.renderer.domElement,
            this.objects,
            this.vscode,
            this.character
        );

        this.ui.hideLoading();

        this.ui.hideLoading();

        // Listen for description updates from the extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (!this.objects) { return; }

            switch (message.type) {
                case 'updateObjectDescription':
                    this.objects.applyDescription(message.data.filePath, message.data.description);
                    break;
            }
        });

        // Initialize Test Bridge for automated testing
        // Delay initialization to avoid blocking the main thread during startup
        setTimeout(() => {
            try {
                new TestBridge(this.sceneManager, this.objects, this.character, this.vscode);
            } catch (e) {
                console.error('Failed to initialize TestBridge:', e);
            }
        }, 1000);

        this.animate();
    }

    /** Main animation loop */
    private animate(): void {
        requestAnimationFrame(() => this.animate());

        const currentTime = performance.now();
        const deltaTime = this.lastTime ? (currentTime - this.lastTime) / 1000 : 0;
        this.lastTime = currentTime;

        this.character.update(deltaTime);

        // Update environment animations (clouds drifting, etc.)
        this.sceneManager.environment.update(deltaTime);

        // Pass actual dependency and circular counts to UI
        const depCount = this.objects.getDependencyCount();
        const circularCount = this.objects.getCircularCount();
        this.ui.update(deltaTime, this.objects.getObjectCount(), depCount, circularCount);

        // Update dependency animations (pulsing for circular deps)
        this.objects.updateDependencies(deltaTime);

        this.interaction.update();

        // Rotate all code objects slowly
        const rotationSpeed = 0.5; // radians per second
        const focusedObject = this.objects.getFocusedObject(); // Use hover focus for rotation

        for (const obj of this.objects.getObjects()) {
            // If this is the focused object, face the camera
            if (focusedObject && obj.id === focusedObject.id) {
                // Calculate angle from object to camera
                const angleToCamera = Math.atan2(
                    this.sceneManager.camera.position.x - obj.mesh.position.x,
                    this.sceneManager.camera.position.z - obj.mesh.position.z
                );

                // The object has two readable sides: front (rotation matching angleToCamera)
                // and back (rotation + PI). Pick whichever requires less rotation.
                const currentRotation = obj.mesh.rotation.y;

                // Option 1: Face the camera with front side
                let diffFront = angleToCamera - currentRotation;
                while (diffFront > Math.PI) { diffFront -= Math.PI * 2; }
                while (diffFront < -Math.PI) { diffFront += Math.PI * 2; }

                // Option 2: Face the camera with back side (rotate PI more)
                let diffBack = (angleToCamera + Math.PI) - currentRotation;
                while (diffBack > Math.PI) { diffBack -= Math.PI * 2; }
                while (diffBack < -Math.PI) { diffBack += Math.PI * 2; }

                // Pick the option that requires less rotation
                const rotDiff = Math.abs(diffFront) <= Math.abs(diffBack) ? diffFront : diffBack;

                // Smooth lerp towards target
                obj.mesh.rotation.y += rotDiff * 5.0 * deltaTime;

            } else {
                // Ambient rotation
                obj.mesh.rotation.y += rotationSpeed * deltaTime;
            }

            // Keep description sprite scale consistent with content
            if (obj.descriptionMesh && obj.descriptionMesh.userData.width && obj.descriptionMesh.userData.height) {
                obj.descriptionMesh.scale.set(
                    obj.descriptionMesh.userData.width,
                    obj.descriptionMesh.userData.height,
                    1
                );
            }
        }

        // Update description labels to face the camera
        this.objects.updateDescriptions(this.sceneManager.camera);

        this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    }

    /** Public API for extensions to manipulate the world */
    public addCodeObject(data: any): void {
        this.objects.addObject(data);
    }

    public removeCodeObject(id: string): void {
        this.objects.removeObject(id);
    }

    public addDependency(data: any): void {
        this.objects.addDependency(data);
    }

    public removeDependency(id: string): void {
        this.objects.removeDependency(id);
    }

    public clear(): void {
        this.objects.clear();
    }

    public showAllDependencies(): void {
        this.objects.showAllDependencies();
    }

    public hideDependencies(): void {
        this.objects.hideDependencies();
    }

    public refreshLabels(): void {
        this.objects.refreshLabelsWithDependencyStats();
    }

    /** Set zone bounds and create visual markers (signs and fences) */
    public setZoneBounds(zones: ZoneBounds[]): void {
        // Remove previous zone visuals if any
        removeZoneVisuals(this.sceneManager.scene);

        // Add new zone signs and fences
        addZoneVisuals(this.sceneManager.scene, zones);
    }
}
