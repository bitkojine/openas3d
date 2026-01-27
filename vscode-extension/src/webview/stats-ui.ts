/**
 * UI component for displaying statistics and loading state
 */
export class StatsUI {
    private frameCount: number = 0;
    public isCollapsed: boolean = false;
    private contentElement: HTMLElement;

    constructor(
        private statsElement: HTMLElement,
        private loadingElement: HTMLElement
    ) {
        this.statsElement.classList.add('micro-panel');

        // Header
        const header = document.createElement('div');
        header.className = 'micro-panel-header';
        Object.assign(header.style, {
            padding: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            borderBottom: '1px solid var(--vscode-editorWidget-border)',
            background: 'var(--vscode-editor-background)',
            borderRadius: '8px 8px 0 0'
        });
        header.onclick = () => this.toggleCollapse();

        const titleGroup = document.createElement('div');
        titleGroup.style.display = 'flex';
        titleGroup.style.alignItems = 'center';
        titleGroup.style.gap = '8px';

        const icon = document.createElement('div');
        icon.textContent = '📊';
        Object.assign(icon.style, {
            width: '20px',
            height: '20px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px'
        });
        titleGroup.appendChild(icon);

        const title = document.createElement('h3');
        title.textContent = 'Statistics';
        Object.assign(title.style, {
            margin: '0',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: '600'
        });
        titleGroup.appendChild(title);
        header.appendChild(titleGroup);

        this.statsElement.appendChild(header);

        // Content
        this.contentElement = document.createElement('div');
        this.contentElement.className = 'micro-panel-content';
        this.contentElement.style.padding = '12px';
        this.statsElement.appendChild(this.contentElement);
    }

    public toggleCollapse(): void {
        this.setCollapsed(!this.isCollapsed);
    }

    public setCollapsed(collapsed: boolean): void {
        this.isCollapsed = collapsed;
        this.statsElement.classList.toggle('collapsed', this.isCollapsed);
    }

    /** Hide the loading screen */
    public hideLoading(): void {
        this.loadingElement.classList.add('hidden');
    }

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

            this.contentElement.innerHTML = html;
        }
    }
}
