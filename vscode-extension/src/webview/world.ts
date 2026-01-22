// Declare the global VSCode API for the webview environment
declare const acquireVsCodeApi: () => {
    postMessage: (msg: any) => void;
    getState: () => any;
    setState: (state: any) => void;
};

import { SceneManager } from './scene-manager';
import { CharacterController } from './character-controller';
import { CodeObjectManager } from './code-object-manager';
import { SelectionManager } from './selection-manager';
import { WarningManager } from './warning-manager';
import { InteractionController } from './interaction-controller';
import { StatsUI } from './stats-ui';
import { TestBridge } from './test-utils/test-bridge';
import { addZoneVisuals, removeZoneVisuals, ZoneDTO } from './zone-visuals';
import { WarningOverlay } from './warning-overlay';
import { ArchitectureWarning } from '../visualizers/architecture-analyzer';

/**
 * The World class is the root controller for the 3D environment.
 * It coordinates the Scene, Physical Simulation, User Interaction, and Data Synchronization.
 */
export class World {
    private sceneManager: SceneManager;
    private character: CharacterController;
    private objects: CodeObjectManager;
    private selectionManager: SelectionManager;
    private warningManager: WarningManager;
    private interaction: InteractionController;
    private ui: StatsUI;
    private warningOverlay: WarningOverlay;

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
        this.selectionManager = new SelectionManager(this.sceneManager.scene);
        this.warningManager = new WarningManager();

        this.ui = new StatsUI(statsEl, loadingEl);

        this.interaction = new InteractionController(
            this.sceneManager.camera,
            this.sceneManager.renderer.domElement,
            this.objects,
            this.selectionManager,
            this.vscode,
            this.character
        );

        // Initialize warning overlay
        this.warningOverlay = new WarningOverlay(container);
        this.warningOverlay.setOnWarningClick((fileId) => {
            // Navigate to file when warning is clicked
            this.vscode.postMessage({ type: 'navigateToFile', data: { fileId } });
        });

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
                // We We might need to update TestBridge to use selection manager too if it relies on it?
                // TestBridge constructor signature: (scene, objects, selection, character, vscode)
                new TestBridge(this.sceneManager, this.objects, this.selectionManager, this.character, this.vscode);
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
        const focusedObject = this.selectionManager.getFocusedObject(); // Use hover focus for rotation

        for (const obj of this.objects.getObjects()) {
            // If this is the focused object, face the camera
            if (focusedObject && obj.id === focusedObject.id) {
                // Calculate angle from object to camera
                const angleToCamera = Math.atan2(
                    this.sceneManager.camera.position.x - obj.position.x, // Use obj.position from DTO
                    this.sceneManager.camera.position.z - obj.position.z
                );

                // We need access to the MESH to rotate it.
                // The DTO iterator returns DTOs which have `mesh` property in `CodeEntityDTO`?
                // `CodeEntityDTO` has `mesh: THREE.Mesh`.
                // Let's check `toCodeObject`... yes it returns `this` which IS a VisualObject which has `mesh`.

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
    public setZoneBounds(zones: ZoneDTO[]): void {
        // Remove previous zone visuals if any
        removeZoneVisuals(this.sceneManager.scene);

        // Add new zone signs and fences
        addZoneVisuals(this.sceneManager.scene, zones);
    }

    /** Set architecture warnings to display in the overlay */
    public setWarnings(warnings: ArchitectureWarning[]): void {
        this.warningOverlay.setWarnings(warnings);
        // Also update object badges
        this.warningManager.setWarnings(warnings, this.objects.getInternalObjectsMap());
    }
}
