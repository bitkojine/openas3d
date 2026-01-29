import { analyzeArchitecture } from '../architecture-analyzer';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

describe('analyzeArchitecture (Integration)', () => {
    let tempDir: string;
    const extensionPath = path.resolve(__dirname, '../../../../');

    beforeAll(() => {
        // Create a temporary project structure
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openas3d-test-'));

        // Mock package.json
        fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify({
            name: 'test-project',
            version: '1.0.0'
        }));

        // Mock tsconfig
        fs.writeFileSync(path.join(tempDir, 'tsconfig.json'), JSON.stringify({
            compilerOptions: {
                baseUrl: ".",
                paths: { "*": ["src/*"] },
                module: "commonjs",
                target: "es6"
            }
        }));

        const srcDir = path.join(tempDir, 'src');
        fs.mkdirSync(srcDir);

        // Circular dependency: a -> b -> a
        fs.writeFileSync(path.join(srcDir, 'a.ts'), "import { b } from './b';\nexport const a = 1;");
        fs.writeFileSync(path.join(srcDir, 'b.ts'), "import { a } from './a';\nexport const b = 1;");

        // Layer violation: src/utils/utils.ts -> src/api/api.ts
        const configContent = `
            module.exports = {
                forbidden: [
                    {
                        name: 'no-circular',
                        severity: 'error',
                        from: {},
                        to: { circular: true }
                    },
                    {
                        name: 'layer-no-utils-to-api',
                        severity: 'error',
                        from: { path: 'src/utils/' },
                        to: { path: 'src/api/' }
                    }
                ],
                options: {
                    tsPreCompilationDeps: true
                }
            };
        `;
        fs.writeFileSync(path.join(tempDir, '.dependency-cruiser.cjs'), configContent);

        const apiDir = path.join(srcDir, 'api');
        fs.mkdirSync(apiDir);
        fs.writeFileSync(path.join(apiDir, 'api.ts'), "export const API = 1;");

        const utilsDir = path.join(srcDir, 'utils');
        fs.mkdirSync(utilsDir);
        fs.writeFileSync(path.join(utilsDir, 'utils.ts'), "import { API } from '../api/api';\nexport const util = API;");

        // Entry point with many dependencies
        fs.writeFileSync(path.join(srcDir, 'index.ts'),
            Array.from({ length: 20 }, (_, i) => `import './dep${i}';`).join('\n')
        );
        for (let i = 0; i < 20; i++) {
            fs.writeFileSync(path.join(srcDir, `dep${i}.ts`), "export {}");
        }
    });

    afterAll(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should detect violations in a real project structure', async () => {
        const fileIdMap = new Map<string, string>();
        fileIdMap.set(path.join(tempDir, 'src/a.ts'), 'a-id');
        fileIdMap.set(path.join(tempDir, 'src/b.ts'), 'b-id');
        fileIdMap.set(path.join(tempDir, 'src/utils/utils.ts'), 'utils-id');
        fileIdMap.set(path.join(tempDir, 'src/api/api.ts'), 'api-id');
        fileIdMap.set(path.join(tempDir, 'src/index.ts'), 'index-id');

        const warnings = await analyzeArchitecture(tempDir, fileIdMap, {
            extensionPath
        });

        // 1. Check Circular Dependency
        const circular = warnings.filter(w => w.type === 'circular-dependency');
        expect(circular.length).toBeGreaterThan(0);
        expect(circular.some(w => w.fileId === 'a-id' || w.fileId === 'b-id')).toBe(true);

        // 2. Check Layer Violation
        const layer = warnings.find(w => w.type === 'layer-violation');
        expect(layer).toBeDefined();
        expect(layer?.fileId).toBe('utils-id');

        // 3. Check Entry Bloat
        const bloat = warnings.find(w => w.type === 'entry-bloat');
        expect(bloat).toBeDefined();
        expect(bloat?.fileId).toBe('index-id');
    });
});
