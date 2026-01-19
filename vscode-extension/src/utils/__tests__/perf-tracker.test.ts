import { PerfTracker } from '../perf-tracker';

describe('PerfTracker', () => {
    let perf: PerfTracker;
    let uiReport: string | null = null;

    beforeEach(() => {
        perf = new PerfTracker();
        uiReport = null;
        perf.setUICallback(report => uiReport = report);
    });

    it('records timings and reports correctly', () => {
        const start = perf.start('testTask');
        // Simulate some work
        const duration = 10;
        perf.stop('testTask', start - duration); // force 10ms
        expect(uiReport).toContain('testTask');
    });

    it('handles multiple stops for same label', () => {
        const start1 = perf.start('multiTask');
        perf.stop('multiTask', start1 - 5); 
        const start2 = perf.start('multiTask');
        perf.stop('multiTask', start2 - 15);
        const reportLines = uiReport?.split('\n') || [];
        const multiLine = reportLines.find(l => l.includes('multiTask'));
        expect(multiLine).toBeDefined();
        expect(multiLine).toMatch(/avg/);
    });
});
