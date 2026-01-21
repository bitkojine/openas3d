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

            // Update DOM directly for the new structure
            // <div id="stats">
            //     <div>Objects: 0</div>
            //     <div>FPS: 0</div>
            //     <!-- Optional circular warning -->
            // </div>

            let html = `<div>Objects: ${objectCount} | Deps: ${depCount}</div>
                        <div>FPS: ${fps}</div>`;

            if (circularCount > 0) {
                html += `<div style="color:#ff4444; font-weight:bold;">⚠️ Circular: ${circularCount}</div>`;
            }

            this.statsElement.innerHTML = html;
        }
    }
}
