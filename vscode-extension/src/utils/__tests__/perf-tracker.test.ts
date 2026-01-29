throw new Error("Mock Sabotaged! This test uses mocking (jest.mock, jest.fn, or jest.spyOn).");

import { PerfTracker } from '../perf-tracker';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs', () => ({
    promises: {
        writeFile: jest.fn().mockResolvedValue(undefined)
    }
}));

describe('PerfTracker', () => {
    let perf: PerfTracker;
    let uiReport: { label: string; count: number; avg: number; max: number }[] | null = null;

    beforeEach(() => {
        jest.clearAllMocks();
        perf = new PerfTracker();
        uiReport = null;
        perf.setUICallback(stats => uiReport = stats);
    });

    it('records timings and reports correctly', () => {
        const start = perf.start('testTask');
        // Simulate some work
        const duration = 10;
        perf.stop('testTask', start - duration); // force 10ms

        expect(uiReport).toBeDefined();
        const item = uiReport?.find(s => s.label === 'testTask');
        expect(item).toBeDefined();
        expect(item?.avg).toBeCloseTo(10, 0); // Allow for small execution time differences
    });

    it('handles multiple stops for same label', () => {
        const start1 = perf.start('multiTask');
        perf.stop('multiTask', start1 - 5);
        const start2 = perf.start('multiTask');
        perf.stop('multiTask', start2 - 15);

        const item = uiReport?.find(s => s.label === 'multiTask');
        expect(item).toBeDefined();
        expect(item?.avg).toBeCloseTo(10, 0); // (5+15)/2 + execution time
    });

    it('handles hierarchical calls', () => {
        const parentStart = perf.start('parent');
        const childStart = perf.start('child');
        perf.stop('child', childStart - 10);
        perf.stop('parent', parentStart - 20);

        const parent = uiReport?.find(s => s.label === 'parent');
        const child = uiReport?.find(s => s.label === 'child');

        expect(parent).toBeDefined();
        expect(child).toBeDefined();
    });

    it('exports data to file', async () => {
        const start = perf.start('exportTask');
        perf.stop('exportTask', start - 10);

        const filePath = '/tmp/perf.json';
        await perf.exportData(filePath);

        expect(fs.promises.writeFile).toHaveBeenCalledTimes(1);
        const [pathArg, dataArg] = (fs.promises.writeFile as jest.Mock).mock.calls[0];
        expect(pathArg).toBe(filePath);

        const parsed = JSON.parse(dataArg);
        expect(parsed.traceEvents).toHaveLength(1);
        expect(parsed.traceEvents[0].name).toBe('exportTask');
        expect(parsed.traceEvents[0].ph).toBe('X');
    });

    it('clears data correctly', () => {
        perf.start('t1');
        perf.stop('t1', performance.now());
        expect(uiReport?.find(s => s.label === 't1')).toBeDefined();

        perf.clear();
        perf.report(); // logs to console, but we check internal state indirectly or via empty report

        // We can verify export is empty
        perf.exportData('dummy');
        const [_, dataArg] = (fs.promises.writeFile as jest.Mock).mock.calls[0];
        const parsed = JSON.parse(dataArg);
        expect(parsed.traceEvents).toHaveLength(0);
    });

    it('calculates stats correctly', () => {
        const nowSpy = jest.spyOn(perf, 'now');

        nowSpy.mockReturnValueOnce(1000)
            .mockReturnValueOnce(1100) // taskA: 100ms
            .mockReturnValueOnce(2000)
            .mockReturnValueOnce(2200) // taskA: 200ms
            .mockReturnValueOnce(3000)
            .mockReturnValueOnce(3050); // taskB: 50ms

        perf.start('taskA');
        perf.stop('taskA', 1000);

        perf.start('taskA');
        perf.stop('taskA', 2000);

        perf.start('taskB');
        perf.stop('taskB', 3000);

        const stats = perf.getStats();

        expect(stats).toHaveLength(2);

        const taskA = stats.find(s => s.label === 'taskA');
        expect(taskA).toBeDefined();
        expect(taskA?.count).toBe(2);
        expect(taskA?.avg).toBe(150);
        expect(taskA?.max).toBe(200);

        const taskB = stats.find(s => s.label === 'taskB');
        expect(taskB?.avg).toBe(50);

        nowSpy.mockRestore();
    });
});
