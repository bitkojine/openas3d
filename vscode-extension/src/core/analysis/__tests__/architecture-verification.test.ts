import { analyzeArchitecture } from '../architecture-analyzer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('analyzeArchitecture Behavioral Tests (No-Mock)', () => {
    let tempDir: string;
    const fileIdMap = new Map<string, string>();

    beforeAll(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-test-'));
        const rootPath = tempDir;

        // Define some files
        const files = ['src/index.ts', 'src/utils.ts', 'src/api.ts'];
        files.forEach(f => {
            const abs = path.join(rootPath, f);
            fs.mkdirSync(path.dirname(abs), { recursive: true });
            fs.writeFileSync(abs, '// dummy content');
            fileIdMap.set(abs, f);
        });

        // Create a dummy dependency-cruiser CLI
        const binDir = path.join(tempDir, 'node_modules', 'dependency-cruiser', 'bin');
        fs.mkdirSync(binDir, { recursive: true });
    });

    afterAll(() => {
        if (tempDir && fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    });

    const setupDummyCLI = (output: any) => {
        const scriptPath = path.join(tempDir, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruise.mjs');
        fs.writeFileSync(scriptPath, `console.log(JSON.stringify(${JSON.stringify(output)}))`);
    };

    it('should successfully run architecture analysis by falling back to node if host spawn fails', async () => {
        /**
         * What bug does this cover?
         * [Architecture Analysis Error]: spawn ... ENOENT
         * 
         * Realistically: Spawning process.execPath (the VS Code helper) can fail on macOS.
         * 
         * NO-MOCK PROOF:
         * We pass an invalid path as the first candidate. The real spawning logic will fail 
         * with ENOENT and gracefully try 'node'.
         */
        setupDummyCLI({ summary: { violations: [] }, modules: [] });

        const warnings = await analyzeArchitecture(tempDir, fileIdMap, {
            extensionPath: tempDir,
            _executables: ['/non-existent/path/to/binary', 'node']
        });

        expect(warnings).toEqual([]);
    });

    it('should detect circular dependencies reported by CLI', async () => {
        setupDummyCLI({
            summary: {
                violations: [
                    {
                        from: 'src/index.ts',
                        to: 'src/utils.ts',
                        rule: { name: 'no-circular' },
                        cycle: ['src/index.ts', 'src/utils.ts']
                    }
                ]
            },
            modules: []
        });

        const warnings = await analyzeArchitecture(tempDir, fileIdMap, {
            extensionPath: tempDir,
            _executables: ['node']
        });

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatchObject({
            fileId: 'src/index.ts',
            type: 'circular-dependency',
            severity: 'high'
        });
    });

    it('should detect layer violations reported by CLI', async () => {
        setupDummyCLI({
            summary: {
                violations: [
                    {
                        from: 'src/utils.ts',
                        to: 'src/api.ts',
                        rule: { name: 'layer-no-utils-to-api' }
                    }
                ]
            },
            modules: []
        });

        const warnings = await analyzeArchitecture(tempDir, fileIdMap, {
            extensionPath: tempDir,
            _executables: ['node']
        });

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatchObject({
            fileId: 'src/utils.ts',
            type: 'layer-violation',
            targetId: 'src/api.ts'
        });
    });
});
