// __tests__/codebase-layout.test.ts
jest.mock('vscode'); // Use the __mocks__/vscode.ts

import { CodebaseLayoutEngine } from '../codebase';

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
});
