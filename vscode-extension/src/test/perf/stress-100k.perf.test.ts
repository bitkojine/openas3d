import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { CodebaseAnalyzer } from '../../visualizers/codebase-analyzer';
import { CodebaseLayoutEngine } from '../../visualizers/codebase-layout';
import { CodebaseVisualizer } from '../../visualizers/codebase';

describe('100k Object Stress Test', () => {
    let tempDir: string;

    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openas3d-stress-'));
        console.log(`[STRESS] Creating 100,000 files in ${tempDir}...`);
        createSyntheticWorkspace(tempDir, 100000);
    });

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    test('100k Object Initialization and Layout', async () => {
        jest.setTimeout(60000); // 60s for 100k files
        const mockPanel: any = {
            webview: {
                postMessage: jest.fn()
            }
        };

        const visualizer = new CodebaseVisualizer(path.join(tempDir, 'ext'));

        const start = performance.now();
        console.log('[STRESS] Starting initialization for 100,000 files...');

        await visualizer.initialize(mockPanel, { targetPath: tempDir });

        const duration = performance.now() - start;
        console.log(`[STRESS] Total 100k Initialization (Host side): ${duration.toFixed(2)}ms`);

        // At 100k files, we expect this to take several seconds even with optimizations
        // Target: < 10 seconds for 100k files orchestration
        expect(duration).toBeLessThan(10000);

        // Verify batching efficacy
        const messageCount = mockPanel.webview.postMessage.mock.calls.length;
        console.log(`[STRESS] Total messages sent to webview: ${messageCount}`);

        // 100,000 files / 50 batch size = 2,000 addObjects messages
        // Plus dependencies, positions, etc.
        expect(messageCount).toBeGreaterThan(2000);
    });

    test('CodeObjectManager 100k Object Insertion performance', () => {
        const mockScene: any = { add: jest.fn(), remove: jest.fn() };
        const manager = new CodebaseObjectManagerMock(mockScene);

        const start = performance.now();
        for (let i = 0; i < 100000; i++) {
            manager.addObject({
                id: `obj_${i}`,
                type: 'file',
                filePath: `path/to/file_${i}.ts`,
                position: { x: i, y: 0, z: i },
                metadata: { size: 1000, complexity: 5 }
            });
        }
        const duration = performance.now() - start;

        console.log(`[STRESS] CodeObjectManager 100k Add: ${duration.toFixed(2)}ms`);
        console.log(`[STRESS] Objects in map: ${manager.getObjectCount()}`);

        // Even with mocking, 100k objects in a Map and object creation takes time
        expect(duration).toBeLessThan(5000);
    });
});

/**
 * Partial mock of CodeObjectManager to test JS overhead without real Three.js rendering
 */
class CodebaseObjectManagerMock {
    private objects = new Map<string, any>();
    constructor(private scene: any) { }

    public addObject(data: any): void {
        const visualObject = {
            id: data.id,
            mesh: { position: { setY: () => { } }, userData: {} },
            getHeight: () => 1,
            position: { copy: () => { } },
            metadata: data.metadata,
            toCodeObject: () => ({ id: data.id })
        };
        this.scene.add(visualObject.mesh);
        this.objects.set(data.id, visualObject);
    }

    public getObjectCount(): number {
        return this.objects.size;
    }
}

function createSyntheticWorkspace(baseDir: string, count: number) {
    const srcDir = path.join(baseDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // Use a faster way to write files for stress test
    for (let i = 0; i < count; i++) {
        if (i % 10000 === 0 && i > 0) console.log(`[STRESS] Created ${i} files...`);
        const subDirNum = Math.floor(i / 1000);
        const subDir = path.join(srcDir, `module_${subDirNum}`);
        if (i % 1000 === 0) {
            if (!fs.existsSync(subDir)) {
                fs.mkdirSync(subDir);
            }
        }

        const filePath = path.join(subDir, `file_${i}.ts`);
        // Minimum content for speed
        const content = `import { s } from "../module_0/file_0";\nexport const v${i} = ${i};`;
        fs.writeFileSync(filePath, content);
    }
}
