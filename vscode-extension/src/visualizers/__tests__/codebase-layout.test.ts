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

        // Verify manual coordinates if known (regression test)
        // For now just consistency across runs
    });
});
