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
     */
    /**
     * Update the stats display
     */
    public update(
        deltaTime: number,
        objectCount: number,
        depCount: number,
        perfStats?: { label: string; count: number; avg: number; max: number }[]
    ): void {
        this.frameCount++;

        // Update FPS counter frequently (every 10 frames ≈ 6 times/sec)
        if (this.frameCount % 10 === 0) {
            const fps = Math.round(1 / deltaTime);
            const buildVersion = this.statsElement.getAttribute('data-version') || 'dev';

            // Format numbers with commas
            const fmt = (n: number) => n.toLocaleString();

            let html = `
                <table style="margin-bottom: 8px; width: 100%;">
                    <tr>
                        <td style="opacity:0.7">Objects</td>
                        <td style="text-align:right; font-weight:600">${fmt(objectCount)} objs</td>
                    </tr>
                    <tr>
                        <td style="opacity:0.7">Dependencies</td>
                        <td style="text-align:right; font-weight:600">${fmt(depCount)} deps</td>
                    </tr>
                    <tr>
                        <td style="opacity:0.7">FPS</td>
                        <td style="text-align:right; font-weight:600">${fps} fps</td>
                    </tr>
                </table>
            `;

            // Append performance table if available
            if (perfStats && perfStats.length > 0) {
                html += `
                    <div style="border-top: 1px solid var(--vscode-editorWidget-border); margin: 8px 0; opacity: 0.2"></div>
                    <table><thead><tr><th>Op</th><th style="text-align:right">Cnt</th><th style="text-align:right">Avg</th><th style="text-align:right">Max</th></tr></thead><tbody>
                `;

                perfStats.forEach(stat => {
                    // Remove package prefix for readability, but keep full method name
                    let label = stat.label;
                    if (label.includes('.')) label = label.split('.').pop()!;
                    // No artificial truncation here - let CSS handle overflow if needed

                    // Colorize slow operations via CSS classes
                    let rowClass = '';
                    if (stat.avg > 100) rowClass = 'row-slow';
                    else if (stat.avg > 16) rowClass = 'row-medium';

                    html += `
                        <tr class="${rowClass}">
                            <td style="white-space:nowrap">${label}</td>
                            <td style="text-align:right">${fmt(stat.count)}x</td>
                            <td style="text-align:right">${fmt(Math.round(stat.avg))} ms</td>
                            <td style="text-align:right">${fmt(Math.round(stat.max))} ms</td>
                        </tr>
                    `;
                });
                html += `</tbody></table>`;
            }

            // Build Info Footer
            html += `<div id="build-info">OpenAs3D v${buildVersion}</div>`;

            this.statsElement.innerHTML = html;
        }
    }
}
