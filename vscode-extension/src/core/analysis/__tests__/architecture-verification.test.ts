import { analyzeArchitecture, ArchitectureWarning } from '../architecture-analyzer';
import * as path from 'path';

// Mock vscode module
jest.mock('vscode', () => ({
    window: {
        createOutputChannel: jest.fn().mockReturnValue({
            appendLine: jest.fn()
        })
    }
}));

// Create a mock cruise function that we'll configure per test
const mockCruise = jest.fn();

describe('analyzeArchitecture', () => {
    const rootPath = '/test/root';
    const fileIdMap = new Map<string, string>();
    fileIdMap.set(path.join(rootPath, 'src/index.ts'), 'entry-id');
    fileIdMap.set(path.join(rootPath, 'src/utils.ts'), 'utils-id');
    fileIdMap.set(path.join(rootPath, 'src/api.ts'), 'api-id');

    beforeEach(() => {
        mockCruise.mockReset();
    });

    it('should return warnings for circular dependencies', async () => {
        mockCruise.mockResolvedValue({
            outputType: 'json',
            modules: [],
            summary: {
                violations: [
                    {
                        from: 'src/index.ts',
                        to: 'src/utils.ts',
                        rule: { name: 'no-circular' },
                        cycle: ['src/index.ts', 'src/utils.ts']
                    }
                ]
            }
        });

        const warnings = await analyzeArchitecture(rootPath, fileIdMap, { cruiseOptions: {}, cruiseFn: mockCruise });

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatchObject({
            fileId: 'entry-id',
            type: 'circular-dependency',
            severity: 'high',
            ruleName: 'no-circular',
            message: 'Circular dependency detected'
        });
        expect(warnings[0].cyclePath).toBeDefined();
        expect(warnings[0].cyclePath).toContain('entry-id');
        expect(warnings[0].cyclePath).toContain('utils-id');
        expect(warnings[0].relatedFileIds).toContain('utils-id');
    });

    it('should return warnings for layer violations', async () => {
        mockCruise.mockResolvedValue({
            outputType: 'json',
            modules: [],
            summary: {
                violations: [
                    {
                        from: 'src/utils.ts',
                        to: 'src/api.ts',
                        rule: { name: 'layer-no-utils-to-api' }
                    }
                ]
            }
        });

        const warnings = await analyzeArchitecture(rootPath, fileIdMap, { cruiseOptions: {}, cruiseFn: mockCruise });

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatchObject({
            fileId: 'utils-id',
            type: 'layer-violation',
            severity: 'high',
            ruleName: 'layer-no-utils-to-api',
            targetId: 'api-id',
            message: 'Dependency on `api.ts` violates layer rules'
        });
    });

    it('should handle entry bloat', async () => {
        const bigDeps = Array.from({ length: 20 }, (_, i) => `dep${i}`);
        mockCruise.mockResolvedValue({
            outputType: 'json',
            modules: [
                {
                    source: 'src/index.ts',
                    dependencies: bigDeps
                }
            ],
            summary: { violations: [] }
        });

        const warnings = await analyzeArchitecture(rootPath, fileIdMap, { cruiseOptions: {}, cruiseFn: mockCruise });

        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toMatchObject({
            fileId: 'entry-id',
            type: 'entry-bloat',
            severity: 'low'
        });
    });
});
