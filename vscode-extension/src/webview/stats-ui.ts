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

            let statsText = `Objects: ${objectCount} | Dependencies: ${depCount} | FPS: ${fps}`;

            // Show circular dependency warning
            if (circularCount > 0) {
                statsText += ` | ⚠️ Circular: ${circularCount}`;
            }

            this.statsElement.textContent = statsText;

            // Add warning styling for circular dependencies
            if (circularCount > 0) {
                this.statsElement.style.color = '#ff6b35';
            } else {
                this.statsElement.style.color = '';
            }
        }
    }
}
