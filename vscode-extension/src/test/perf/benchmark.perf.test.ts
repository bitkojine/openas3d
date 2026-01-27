import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodebaseAnalyzer } from '../../visualizers/codebase-analyzer';
import { CodebaseLayoutEngine } from '../../visualizers/codebase-layout';
import { CodebaseVisualizer } from '../../visualizers/codebase';

describe('Performance Benchmarks', () => {
    let tempDir: string;

    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openas3d-perf-'));
        createSyntheticWorkspace(tempDir, 1000); // 1000 files
    });

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('CodebaseAnalyzer.analyzeStreaming performance (1000 files)', async () => {
        const analyzer = new CodebaseAnalyzer(tempDir);
        const start = performance.now();

        let fileCount = 0;
        await analyzer.analyzeStreaming(
            (files) => { fileCount += files.length; },
            () => { }
        );

        const duration = performance.now() - start;
        console.log(`[PERF] CodebaseAnalyzer.analyzeStreaming (1000 files): ${duration.toFixed(2)}ms`);
        expect(fileCount).toBeGreaterThanOrEqual(1000);
        // Target: < 1000ms for 1000 files with sync I/O
        expect(duration).toBeLessThan(2000);
    });

    test('Dependency Graph Construction performance (1000 files)', async () => {
        const analyzer = new CodebaseAnalyzer(tempDir);
        const start = performance.now();

        let edges: any[] = [];
        await analyzer.analyzeStreaming(
            () => { },
            (e) => { edges = e; }
        );
        const duration = performance.now() - start;

        console.log(`[PERF] Full Analysis with Deps (1000 files): ${duration.toFixed(2)}ms`);
        console.log(`[PERF] Edges count: ${edges.length}`);
        expect(edges.length).toBeGreaterThan(0);
        expect(duration).toBeLessThan(1000);
    });

    test('CodebaseLayoutEngine performance (1000 objects)', () => {
        const mockPersistence: any = {
            load: () => ({}),
            getOverride: () => null
        };
        const layout = new CodebaseLayoutEngine(mockPersistence);

        const files = Array.from({ length: 1000 }, (_, i) => ({
            id: `file_${i}`,
            filePath: `src/module_${Math.floor(i / 50)}/file_${i}.ts`,
            zone: i < 500 ? 'zone_a' : 'zone_b',
            lines: 100,
            size: 5000,
            language: 'typescript'
        }));

        const start = performance.now();
        const positions = layout.computePositions(files as any);
        const duration = performance.now() - start;

        console.log(`[PERF] CodebaseLayoutEngine.computePositions (1000 files): ${duration.toFixed(2)}ms`);
        expect(positions.size).toBe(1000);
        // Layout should be very fast
        expect(duration).toBeLessThan(500);
    });

    test('CodebaseVisualizer Initialization performance (E2E)', async () => {
        const mockPanel: any = {
            webview: {
                postMessage: jest.fn()
            }
        };
        const visualizer = new CodebaseVisualizer(path.join(tempDir, 'ext'));

        const start = performance.now();
        await visualizer.initialize(mockPanel, { targetPath: tempDir });
        const duration = performance.now() - start;

        console.log(`[PERF] CodebaseVisualizer.initialize (1000 files): ${duration.toFixed(2)}ms`);
        expect(duration).toBeLessThan(1000); // Expect initialization to be fast
    });

    test('Comprehensive Loading Pipeline performance (1000 files, with Architecture)', async () => {
        const mockPanel: any = {
            webview: {
                postMessage: jest.fn()
            }
        };

        // We mock architecture analysis to isolate orchestrator overhead
        // The real architecture-analyzer is tested elsewhere.
        jest.mock('../../core/analysis/architecture-analyzer', () => ({
            analyzeArchitecture: jest.fn().mockImplementation(async () => {
                await new Promise(r => setTimeout(r, 650)); // Simulate CLI delay
                return [];
            })
        }));

        const visualizer = new CodebaseVisualizer(path.join(tempDir, 'ext'));

        const start = performance.now();
        await visualizer.initialize(mockPanel, { targetPath: tempDir });
        const mainFlowDuration = performance.now() - start;

        console.log(`[PERF] E2E Main Flow (Visuals appearing): ${mainFlowDuration.toFixed(2)}ms`);

        // Verify visuals appeared fast
        expect(mainFlowDuration).toBeLessThan(1000);

        // Verify messages were sent
        const messages = mockPanel.webview.postMessage.mock.calls.map((c: any) => c[0].type);
        expect(messages).toContain('addObjects');
        expect(messages).toContain('addDependencies');
        expect(messages).toContain('setZoneBounds');
        expect(messages).toContain('updateObjectPositions');

        console.log(`[PERF] Total E2E Orchestration (Scan to Layout) for 1000 files: ${mainFlowDuration.toFixed(2)}ms`);
    });

    test('Large File Analysis performance (5MB file)', async () => {
        const largeFilePath = path.join(tempDir, 'large_file.ts');
        const content = 'import { something } from "./other";\n'.repeat(150000); // ~5.5MB of content
        fs.writeFileSync(largeFilePath, content);

        const analyzer = new CodebaseAnalyzer(tempDir);
        const start = performance.now();
        const fileInfo = await analyzer.analyzeFile(largeFilePath);
        const duration = performance.now() - start;

        console.log(`[PERF] Large File Analysis (5MB): ${duration.toFixed(2)}ms`);
        expect(fileInfo).not.toBeNull();
        expect(fileInfo?.size).toBeGreaterThan(4 * 1024 * 1024);
        // Should be fast due to 64KB chunking
        expect(duration).toBeLessThan(200);
    });

    test('Extreme File Size performance (500MB file)', async () => {
        const extremeFilePath = path.join(tempDir, 'extreme_file.bin');
        // Create a sparse file - very fast
        const fd = fs.openSync(extremeFilePath, 'w');
        fs.writeSync(fd, 'import { something } from "./other";\n');
        fs.ftruncateSync(fd, 500 * 1024 * 1024);
        fs.closeSync(fd);

        const analyzer = new CodebaseAnalyzer(tempDir);
        const start = performance.now();
        const fileInfo = await analyzer.analyzeFile(extremeFilePath);
        const duration = performance.now() - start;

        console.log(`[PERF] Extreme File Analysis (500MB): ${duration.toFixed(2)}ms`);
        expect(fileInfo).not.toBeNull();
        expect(fileInfo?.size).toBe(500 * 1024 * 1024);
        // Should STILL be extremely fast due to 64KB chunking
        expect(duration).toBeLessThan(100);
    });
});

/**
 * Creates a synthetic workspace with many files.
 */
function createSyntheticWorkspace(baseDir: string, count: number) {
    const srcDir = path.join(baseDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    for (let i = 0; i < count; i++) {
        const subDir = path.join(srcDir, `module_${Math.floor(i / 50)}`);
        if (!fs.existsSync(subDir)) {
            fs.mkdirSync(subDir);
        }

        const filePath = path.join(subDir, `file_${i}.ts`);
        const imports = Array.from({ length: 5 }, (_, j) => {
            const target = Math.floor(Math.random() * count);
            return `import { Something } from "../module_${Math.floor(target / 50)}/file_${target}";`;
        }).join('\n');

        const content = `
${imports}
export class Class${i} {
    method() {
        console.log("Hello ${i}");
    }
}
        `;
        fs.writeFileSync(filePath, content);
    }
}
