// __tests__/codebase-layout.test.ts
jest.mock('vscode'); // Use the __mocks__/vscode.ts

import { CodebaseLayoutEngine } from '../codebase-layout';

describe('CodebaseLayoutEngine', () => {
    it('computes positions consistently', () => {
        const engine = new CodebaseLayoutEngine();

        // Minimal valid CodeFile objects
        const files = [
            { id: 'file1', filePath: 'src/file1.ts', language: 'typescript', size: 100, lines: 10 } as any,
            { id: 'file2', filePath: 'src/file2.ts', language: 'typescript', size: 200, lines: 20 } as any,
        ];

        const positions = engine.computePositions(files);

        expect(positions.get('file1')).toBeDefined();
        expect(positions.get('file2')).toBeDefined();

        // file1 and file2 should not have the same position
        expect(positions.get('file1')).not.toEqual(positions.get('file2'));
    });

    it('produces deterministic output for same input', () => {
        const engine = new CodebaseLayoutEngine();
        const files = [
            { id: 'f1', filePath: 'src/main.ts', language: 'typescript', size: 50, lines: 10 } as any,
            { id: 'f2', filePath: 'src/utils.ts', language: 'typescript', size: 30, lines: 5 } as any,
        ];

        const pos1 = engine.computePositions(files);
        const pos2 = engine.computePositions(files);

        // Positions should be exactly equal
        const p1_f1 = pos1.get('f1');
        const p2_f1 = pos2.get('f1');

        expect(p1_f1).toBeDefined();
        expect(p1_f1).toEqual(p2_f1);
    });

    describe('zone assignment', () => {
        let engine: CodebaseLayoutEngine;

        beforeEach(() => {
            engine = new CodebaseLayoutEngine();
        });

        it('assigns test files to tests zone', () => {
            expect(engine.getZoneForFile({ filePath: 'src/utils.test.ts' } as any)).toBe('tests');
            expect(engine.getZoneForFile({ filePath: 'src/__tests__/utils.ts' } as any)).toBe('tests');
            expect(engine.getZoneForFile({ filePath: '/test/integration.ts' } as any)).toBe('tests');
            expect(engine.getZoneForFile({ filePath: 'src/component.spec.js' } as any)).toBe('tests');
        });

        it('assigns script files to scripts zone', () => {
            expect(engine.getZoneForFile({ filePath: 'scripts/deploy.sh' } as any)).toBe('scripts');
            expect(engine.getZoneForFile({ filePath: 'bin/install.bash' } as any)).toBe('scripts');
        });

        it('assigns asset files to assets zone', () => {
            expect(engine.getZoneForFile({ filePath: 'assets/logo.png' } as any)).toBe('assets');
            expect(engine.getZoneForFile({ filePath: 'fonts/roboto.woff2' } as any)).toBe('assets');
            expect(engine.getZoneForFile({ filePath: 'media/video.mp4' } as any)).toBe('assets');
        });

        it('assigns source files to source zone', () => {
            expect(engine.getZoneForFile({ filePath: 'src/main.ts' } as any)).toBe('source');
            expect(engine.getZoneForFile({ filePath: 'lib/utils.py' } as any)).toBe('source');
        });

        it('assigns documentation to docs zone', () => {
            expect(engine.getZoneForFile({ filePath: 'README.md' } as any)).toBe('docs');
            expect(engine.getZoneForFile({ filePath: 'docs/guide.txt' } as any)).toBe('docs');
        });

        it('assigns config files to configs zone', () => {
            expect(engine.getZoneForFile({ filePath: 'package.json' } as any)).toBe('configs');
            expect(engine.getZoneForFile({ filePath: 'tsconfig.json' } as any)).toBe('configs');
        });

        it('assigns build output to build zone', () => {
            // Note: source file extensions (.js, .ts) take priority over build paths,
            // so we test with non-source extensions like .map and .css
            expect(engine.getZoneForFile({ filePath: '/dist/bundle.js.map' } as any)).toBe('build');
            expect(engine.getZoneForFile({ filePath: '/build/output.css' } as any)).toBe('build');
        });
    });

    describe('zone bounds', () => {
        it('returns zone bounds after computing positions', () => {
            const engine = new CodebaseLayoutEngine();
            const files = [
                { id: 'f1', filePath: 'src/main.ts' } as any,
                { id: 'f2', filePath: 'src/utils.ts' } as any,
            ];

            engine.computePositions(files);
            const bounds = engine.getZoneBounds();

            expect(bounds.length).toBeGreaterThan(0);
            const sourceBounds = bounds.find(b => b.name === 'source');
            expect(sourceBounds).toBeDefined();
            expect(sourceBounds!.fileCount).toBe(2);
            expect(sourceBounds!.displayName).toBe('Source Code');
        });
    });

    describe('spiral expansion', () => {
        it('places files in expanding spiral pattern', () => {
            const engine = new CodebaseLayoutEngine();

            // Create 10 files in the same zone
            const files = Array.from({ length: 10 }, (_, i) => ({
                id: `f${i}`,
                filePath: `src/file${i}.ts`
            } as any));

            const positions = engine.computePositions(files);

            // All positions should be unique
            const posArray = Array.from(positions.values());
            const uniquePositions = new Set(posArray.map(p => `${p.x},${p.z}`));
            expect(uniquePositions.size).toBe(10);

            // First file should be at zone center
            const firstPos = positions.get('f0');
            expect(firstPos).toBeDefined();
            // Source zone is centered at (0, 0)
            expect(firstPos!.x).toBe(0);
            expect(firstPos!.z).toBe(0);
        });

        it('handles large file counts without collision', () => {
            const engine = new CodebaseLayoutEngine();

            // Create 100 files in the same zone
            const files = Array.from({ length: 100 }, (_, i) => ({
                id: `f${i}`,
                filePath: `src/file${i}.ts`
            } as any));

            const positions = engine.computePositions(files);

            // All positions should be unique
            const posArray = Array.from(positions.values());
            const uniquePositions = new Set(posArray.map(p => `${p.x},${p.z}`));
            expect(uniquePositions.size).toBe(100);
        });
    });

    describe('zone configuration', () => {
        it('returns all zone configs', () => {
            const engine = new CodebaseLayoutEngine();
            const zones = engine.getAllZones();

            expect(zones.length).toBe(8);
            expect(zones.map(z => z.name).sort()).toEqual([
                'assets', 'build', 'configs', 'docs', 'other', 'scripts', 'source', 'tests'
            ]);
        });

        it('returns zone config by name', () => {
            const engine = new CodebaseLayoutEngine();

            const sourceConfig = engine.getZoneConfig('source');
            expect(sourceConfig).toBeDefined();
            expect(sourceConfig!.displayName).toBe('Source Code');
            expect(sourceConfig!.xCenter).toBe(0);
            expect(sourceConfig!.zCenter).toBe(0);
        });
    });
});
