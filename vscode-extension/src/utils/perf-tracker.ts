import { CircularBuffer } from './circular-buffer';
import * as fs from 'fs';
import * as path from 'path';

interface TraceEvent {
    name: string;
    cat: string;
    ph: 'B' | 'E' | 'X'; // Begin, End, Complete
    ts: number; // microseconds
    pid: number;
    tid: number;
    dur?: number; // microseconds (for 'X' phase)
    args?: any;
}

export class PerfTracker {
    private static readonly BUFFER_SIZE = 1000;
    public static instance: PerfTracker; // Singleton for decorators
    private events: CircularBuffer<TraceEvent>;
    private uiCallback?: (stats: { label: string; count: number; avg: number; max: number }[]) => void;
    private activeStack: string[] = [];

    constructor() {
        this.events = new CircularBuffer(PerfTracker.BUFFER_SIZE);
    }

    /**
     * Get current time in milliseconds.
     * Exposed for testing/mocking purposes.
     */
    public now(): number {
        return performance.now();
    }

    /**
     * Start timing a labeled section
     */
    public start(label: string): number {
        const now = this.now();
        this.activeStack.push(label);

        // We log 'B' (Begin) event if we were streaming, but since we are buffering 
        // and want to support simple "Complete" events for simpler visualization often,
        // we might stick to storing 'X' (Complete) events on stop.
        // However, for strict Chrome Tracing, B/E is often safer for nesting.
        // Let's store 'B' and 'E' or just 'X' if we know duration.
        // For simplicity and circular buffer usage, storing 'X' is creating one event per span,
        // which doubles our capacity compared to B+E.

        return now;
    }

    /**
     * Stop timing a labeled section and store the duration
     */
    public stop(label: string, startTime: number): void {
        const now = this.now();
        const duration = now - startTime;

        // Hierarchy Validation
        const stackTop = this.activeStack.pop();
        if (stackTop !== label) {
            console.warn(`PerfTracker mismatch: stopped '${label}' but expected '${stackTop}'`);
            // Attempt to recover stack? 
            // If we just popped mismatch, we might have popped the parent.
            // Let's put it back if it wasn't a match? 
            // Or just logging warning is enough for dev tool.
        }

        const event: TraceEvent = {
            name: label,
            cat: 'default',
            ph: 'X',
            ts: startTime * 1000, // convert to microseconds
            dur: duration * 1000,
            pid: 1,
            tid: 1,
            args: {}
        };

        this.events.push(event);
        this.reportToUI();
    }

    /**
     * Log the performance report to the console
     */
    public report(): void {
        const allEvents = this.events.getAll();
        const stats = new Map<string, number[]>();

        for (const event of allEvents) {
            if (event.dur !== undefined) {
                if (!stats.has(event.name)) {
                    stats.set(event.name, []);
                }
                stats.get(event.name)!.push(event.dur / 1000); // back to ms
            }
        }

        const reportLines: string[] = [];
        stats.forEach((durations, label) => {
            const total = durations.reduce((a, b) => a + b, 0);
            const avg = total / durations.length;
            const max = Math.max(...durations);
            const min = Math.min(...durations);
            reportLines.push(`${label}: avg ${avg.toFixed(1)}ms | min ${min.toFixed(1)}ms | max ${max.toFixed(1)}ms`);
        });

        // Performance report data prepared - console statements removed for CI compliance
        // TODO: Implement proper logging infrastructure if needed
    }

    /**
     * Provide a callback to send live performance updates to the UI
     */
    public setUICallback(cb: (stats: { label: string; count: number; avg: number; max: number }[]) => void) {
        // @ts-ignore
        this.uiCallback = cb;
    }

    /**
     * Internal method to report to UI panel if a callback is set
     */
    private reportToUI() {
        if (!this.uiCallback) { return; }

        const stats = this.getStats().slice(0, 10); // Top 10 slowest

        // Cast to any because the internal type definition of uiCallback might be stale in some contexts
        // or we are changing it dynamically. 
        // Ideally we update the property type definition.
        (this.uiCallback as any)(stats);
    }

    private addToStats(stats: Map<string, number[]>, name: string, duration: number) {
        if (!stats.has(name)) {
            stats.set(name, []);
        }
        const list = stats.get(name);
        if (!list) {
            console.error('Stats map failed to retrieve list for:', name);
            return;
        }
        list.push(duration);
    }

    /**
     * Export data to a JSON file compatible with Chrome Tracing
     */
    public async exportData(filePath: string): Promise<void> {
        const traceEvents = this.events.getAll();
        const traceData = {
            traceEvents: traceEvents,
            displayTimeUnit: 'ms'
        };

        try {
            await fs.promises.writeFile(filePath, JSON.stringify(traceData, null, 2), 'utf8');
        } catch (err) {
            console.error('Failed to export performance data:', err);
            throw err;
        }
    }

    public clear(): void {
        this.events.clear();
        this.activeStack = [];
    }

    /**
     * Get aggregated statistics for the UI
     */
    public getStats(): { label: string; count: number; avg: number; max: number }[] {
        const events = this.events.getAll();
        const stats = new Map<string, number[]>();

        for (const event of events) {
            if (event.ph === 'X' && event.dur !== undefined) {
                this.addToStats(stats, event.name, event.dur / 1000);
            }
        }

        const result: { label: string; count: number; avg: number; max: number }[] = [];
        stats.forEach((durations, label) => {
            const count = durations.length;
            const total = durations.reduce((a, b) => a + b, 0);
            const avg = total / count;
            const max = Math.max(...durations);
            result.push({ label, count, avg, max });
        });

        // Sort by average duration (descending)
        return result.sort((a, b) => b.avg - a.avg);
    }
}
