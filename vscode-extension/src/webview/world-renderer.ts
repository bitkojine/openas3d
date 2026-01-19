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

export class WorldRenderer {
    private sceneManager: SceneManager;
    private character: CharacterController;
    private objects: CodeObjectManager;
    private interaction: InteractionController;
    private ui: StatsUI;

    private vscode: any = acquireVsCodeApi();

    private lastTime: number = 0;

    constructor() {
        const container = document.getElementById('renderer')!;
        const statsEl = document.getElementById('stats')!;
        const loadingEl = document.getElementById('loading')!;

        this.sceneManager = new SceneManager(container);

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

        // Notify extension that webview is ready
        this.vscode.postMessage({ type: 'ready' });

        // Listen for description updates from the extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            if (!this.objects) return;

            switch (message.type) {
                case 'updateObjectDescription':
                    this.objects.applyDescription(message.data.filePath, message.data.description);
                    break;
            }
        });

        this.animate();
    }

    /** Main animation loop */
    private animate(): void {
        requestAnimationFrame(() => this.animate());

        const currentTime = performance.now();
        const deltaTime = this.lastTime ? (currentTime - this.lastTime) / 1000 : 0;
        this.lastTime = currentTime;

        this.character.update(deltaTime);
        this.ui.update(deltaTime, this.objects['objects'].size, this.objects['dependencies'].size);

        // Rotate all code objects slowly
        const rotationSpeed = 0.5; // radians per second
        for (const obj of this.objects['objects'].values()) {
            obj.mesh.rotation.y += rotationSpeed * deltaTime;

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
}
