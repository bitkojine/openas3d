// utils/perf-tracker.ts
export class PerfTracker {
    private timings: Map<string, number[]> = new Map();
    private uiCallback?: (report: string) => void;

    /**
     * Start timing a labeled section
     */
    public start(label: string): number {
        return performance.now();
    }

    /**
     * Stop timing a labeled section and store the duration
     */
    public stop(label: string, startTime: number): void {
        const duration = performance.now() - startTime;
        if (!this.timings.has(label)) this.timings.set(label, []);
        this.timings.get(label)!.push(duration);

        this.reportToUI();
    }

    /**
     * Log the performance report to the console
     */
    public report(): void {
        const reportLines: string[] = [];
        this.timings.forEach((durations, label) => {
            const total = durations.reduce((a, b) => a + b, 0);
            const avg = total / durations.length;
            const max = Math.max(...durations);
            const min = Math.min(...durations);
            reportLines.push(
                `${label}: avg ${avg.toFixed(1)}ms | min ${min.toFixed(1)}ms | max ${max.toFixed(1)}ms`
            );
        });
        console.group('Performance Report');
        reportLines.forEach(line => console.log(line));
        console.groupEnd();
    }

    /**
     * Provide a callback to send live performance updates to the UI
     */
    public setUICallback(cb: (report: string) => void) {
        this.uiCallback = cb;
    }

    /**
     * Internal method to report to UI panel if a callback is set
     */
    private reportToUI() {
        if (!this.uiCallback) return;

        const lines: string[] = [];
        this.timings.forEach((durations, label) => {
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            lines.push(`${label}: ${avg.toFixed(1)}ms`);
        });

        this.uiCallback(lines.join('\n'));
    }
}
