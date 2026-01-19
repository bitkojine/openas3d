// src/webview/world-renderer.ts

import { SceneManager } from './scene-manager';
import { CharacterController } from './character-controller';
import { CodeObjectManager } from './code-object-manager';
import { InteractionController } from './interaction-controller';
import { StatsUI } from './stats-ui';
import { WebviewMessaging } from './messaging-webview';

export class WorldRenderer {
    private sceneManager: SceneManager;
    private character: CharacterController;
    private objects: CodeObjectManager;
    private interaction: InteractionController;
    private ui: StatsUI;

    private messaging: WebviewMessaging;

    private lastTime: number = 0;

    constructor() {
        const container = document.getElementById('renderer')!;
        const statsEl = document.getElementById('stats')!;
        const loadingEl = document.getElementById('loading')!;

        // Initialize scene and renderer
        this.sceneManager = new SceneManager(container);

        // Initialize character controller
        this.character = new CharacterController(
            this.sceneManager.camera,
            this.sceneManager.renderer.domElement,
            8.0,   // moveSpeed
            2.0,   // sprintMultiplier
            0.5    // groundHeight
        );
        (this.character as any).placingSign = false;

        // Initialize object manager and UI
        this.objects = new CodeObjectManager(this.sceneManager.scene);
        this.ui = new StatsUI(statsEl, loadingEl);

        // Initialize messaging
        this.messaging = new WebviewMessaging();

        // Initialize interaction controller
        this.interaction = new InteractionController(
            this.sceneManager.camera,
            this.sceneManager.renderer.domElement,
            this.objects,
            this.messaging,
            this.character
        );

        // Hide loading overlay
        this.ui.hideLoading();

        // Notify extension that webview is ready
        this.messaging.send('ready', {});

        // Register message handlers from the extension
        this.messaging.register('updateObjectDescription', (data) => {
            this.objects.applyDescription(data.filePath, data.description);
        });

        this.messaging.register('addObject', (data) => {
            this.objects.addObject(data);
        });

        this.messaging.register('removeObject', (id: string) => {
            this.objects.removeObject(id);
        });

        this.messaging.register('addDependency', (data) => {
            this.objects.addDependency(data);
        });

        this.messaging.register('removeDependency', (id: string) => {
            this.objects.removeDependency(id);
        });

        this.messaging.register('clear', () => {
            this.objects.clear();
        });

        this.messaging.register('showDependencies', () => {
            this.objects.showAllDependencies();
        });

        this.messaging.register('hideDependencies', () => {
            this.objects.hideDependencies();
        });

        // Start animation loop
        this.animate();
    }

    /** Main animation loop */
    private animate(): void {
        requestAnimationFrame(() => this.animate());

        const currentTime = performance.now();
        const deltaTime = this.lastTime ? (currentTime - this.lastTime) / 1000 : 0;
        this.lastTime = currentTime;

        // Update character movement
        this.character.update(deltaTime);

        // Update UI stats
        this.ui.update(deltaTime, this.objects['objects'].size, this.objects['dependencies'].size);

        // Rotate code objects slowly
        const rotationSpeed = 0.5; // radians/sec
        for (const obj of this.objects['objects'].values()) {
            obj.mesh.rotation.y += rotationSpeed * deltaTime;

            if (obj.descriptionMesh && obj.descriptionMesh.userData.width && obj.descriptionMesh.userData.height) {
                obj.descriptionMesh.scale.set(
                    obj.descriptionMesh.userData.width,
                    obj.descriptionMesh.userData.height,
                    1
                );
            }
        }

        // Update description labels to face camera
        this.objects.updateDescriptions(this.sceneManager.camera);

        // Render scene
        this.sceneManager.renderer.render(this.sceneManager.scene, this.sceneManager.camera);
    }

    // ──────────────────────────────────────────────
    // Public API for extension messages
    // ──────────────────────────────────────────────

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
}
