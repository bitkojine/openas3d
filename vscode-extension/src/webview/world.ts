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
import { ThemeManager } from './theme-manager';
import { InteractionController } from './interaction-controller';
import { StatsUI } from './stats-ui';
import { TestBridge } from './test-utils/test-bridge';
import { DependencyManager } from './dependency-manager';
import { ZoneManager } from './zone-manager';
import { ZoneDTO } from '../core/domain/zone';
import { WarningOverlay } from './warning-overlay';
import { ArchitectureWarning } from '../core/analysis/types';
import { updateContentConfig } from './texture-factory';
import { EditorConfig } from '../shared/types';

/**
 * The World class is the root controller for the 3D environment.
 * It coordinates the Scene, Physical Simulation, User Interaction, and Data Synchronization.
 */
export class World {
    private sceneManager: SceneManager;
    private character: CharacterController;
    private objects: CodeObjectManager;
    private dependencyManager: DependencyManager;
    private zoneManager: ZoneManager;
    private selectionManager: SelectionManager;
    private warningManager: WarningManager;
    private themeManager: ThemeManager;
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
        this.dependencyManager = new DependencyManager(this.sceneManager.scene);
        this.zoneManager = new ZoneManager(this.sceneManager.scene);
        this.selectionManager = new SelectionManager(this.sceneManager.scene);
        this.warningManager = new WarningManager();
        this.themeManager = new ThemeManager();

        // Initialize theme
        const initialTheme = this.themeManager.getTheme();
        this.sceneManager.updateTheme(initialTheme);
        this.zoneManager.updateTheme(initialTheme);
        this.themeManager.onThemeChange((theme) => {
            this.sceneManager.updateTheme(theme);
            this.zoneManager.updateTheme(theme);
            this.objects.updateTheme(theme);
        });

        this.ui = new StatsUI(statsEl, loadingEl);

        this.interaction = new InteractionController(
            this.sceneManager.camera,
            this.sceneManager.renderer.domElement,
            this.objects,
            this.selectionManager,
            this.dependencyManager,
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
                // TestBridge constructor signature: (scene, objects, selection, depManager, character, vscode)
                new TestBridge(this.sceneManager, this.objects, this.selectionManager, this.dependencyManager, this.character, this.vscode);
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
        const depCount = this.dependencyManager.getDependencyCount();
        const circularCount = this.dependencyManager.getCircularCount();
        this.ui.update(deltaTime, this.objects.getObjectCount(), depCount, circularCount);

        // Update dependency animations (pulsing for circular deps)
        this.dependencyManager.update(deltaTime);

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
        // We need to pass the map of objects to the dependency manager
        this.dependencyManager.add(data, this.objects.getInternalObjectsMap());
    }

    public removeDependency(id: string): void {
        this.dependencyManager.remove(id);
    }

    public updateObjectPosition(data: { id: string; position: { x: number; y: number; z: number } }): void {
        this.objects.updateObjectPosition(data.id, data.position);
        // Also update connected dependencies
        this.dependencyManager.updateObjectPosition(data.id, this.objects.getInternalObjectsMap());
    }

    public clear(): void {
        this.objects.clear();
        this.dependencyManager.clear();
        this.zoneManager.clear();
    }

    public showAllDependencies(): void {
        this.dependencyManager.showAll();
    }

    public hideDependencies(): void {
        this.dependencyManager.hideAll();
    }

    public refreshLabels(): void {
        // Refresh labels logic relies on dependency stats?
        // CodeObjectManager logic was: get stats from DepManager, then update labels.
        // We can reimplement that coordination here.

        for (const obj of this.objects.getObjects()) {
            // Access internal VisualObject via map to get stats?
            // Actually wait, CodeObjectManager.refreshLabelsWithDependencyStats was removed.
            // We need to re-implement that logic if we want labels to show stats.
            // Or we just skip it for now if labels are static.
            // The implementation plan said "Decouple".
            // If we really want stats on labels, World should coordinate it.

            // For now, let's leave it empty or implement basic logic if needed.
            // The previous logic was:
            /*
            const stats = this.dependencyManager.getStatsForObject(obj.id);
            if (stats.incoming === 0 && stats.outgoing === 0) continue;
            obj.updateLabel(this.scene, obj.description, stats);
            */

            // This requires access to `updateLabel` on the object.
            // `getObjects()` returns DTOs (CodeEntityDTO) which mocks being VisualObject but typescript knows it as DTO.
            // But at runtime they are VisualObjects.

            const stats = this.dependencyManager.getStatsForObject(obj.id);
            if (stats) {
                // Cast to any to access updateLabel if it exists (VisualObject)
                if (typeof (obj as any).updateLabel === 'function') {
                    // We need description text.
                    const desc = (obj as any).metadata?.description || '';

                    const labelStats = {
                        incoming: stats.incoming,
                        outgoing: stats.outgoing,
                        hasCircular: stats.circularWith.length > 0
                    };

                    (obj as any).updateLabel(this.sceneManager.scene, desc, labelStats);
                }
            }
        }
    }

    /** Set zone bounds and create visual markers (signs and fences) */
    public setZoneBounds(zones: ZoneDTO[]): void {
        const currentTheme = this.themeManager.getTheme();
        this.zoneManager.updateZones(zones, currentTheme);
    }

    /** Set architecture warnings to display in the overlay */
    public setWarnings(warnings: ArchitectureWarning[]): void {
        this.warningOverlay.setWarnings(warnings);
        // Also update object badges
        this.warningManager.setWarnings(warnings, this.objects.getInternalObjectsMap());
    }

    public updateConfig(config: EditorConfig): void {
        updateContentConfig(config);

        // Force refresh all objects with current theme
        // This will trigger re-rendering of code textures with new font settings
        const currentTheme = this.themeManager.getTheme();
        this.objects.updateTheme(currentTheme);
    }
}
