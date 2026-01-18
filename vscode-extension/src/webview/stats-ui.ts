export class StatsUI {
    private frameCount: number = 0;

    constructor(
        private statsElement: HTMLElement,
        private loadingElement: HTMLElement
    ) {}

    /** Hide the loading screen */
    public hideLoading(): void {
        this.loadingElement.classList.add('hidden');
    }

    /**
     * Update the stats display
     * @param deltaTime Time elapsed since last frame in seconds
     * @param objectCount Number of code objects in the scene
     * @param depCount Number of dependency lines in the scene
     */
    public update(deltaTime: number, objectCount: number, depCount: number): void {
        this.frameCount++;
        if (this.frameCount % 60 === 0) { // update once per second-ish
            const fps = Math.round(1 / deltaTime);
            this.statsElement.textContent =
                `Objects: ${objectCount} | Dependencies: ${depCount} | FPS: ${fps}`;
        }
    }
}
