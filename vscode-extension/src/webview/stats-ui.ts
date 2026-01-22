/**
 * UI component for displaying statistics and loading state
 */
export class StatsUI {
    private frameCount: number = 0;

    constructor(
        private statsElement: HTMLElement,
        private loadingElement: HTMLElement
    ) { }

    /** Hide the loading screen */
    public hideLoading(): void {
        this.loadingElement.classList.add('hidden');
    }

    /**
     * Update the stats display
     * @param deltaTime Time elapsed since last frame in seconds
     * @param objectCount Number of code objects in the scene
     * @param depCount Number of dependency lines in the scene
     * @param circularCount Number of circular dependencies detected
     */
    public update(
        deltaTime: number,
        objectCount: number,
        depCount: number,
        circularCount: number = 0
    ): void {
        this.frameCount++;
        if (this.frameCount % 60 === 0) { // update once per second-ish
            const fps = Math.round(1 / deltaTime);

            // Simple text update for the minimal bar
            this.statsElement.textContent = `Objects: ${objectCount} | Deps: ${depCount} | FPS: ${fps}`;

            // If circular dependencies exist, we could add a subtle indicator if needed, 
            // but the WarningOverlay is now the primary place for this.
        }
    }
}
