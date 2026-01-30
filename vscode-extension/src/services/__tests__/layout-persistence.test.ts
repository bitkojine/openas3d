import { LayoutPersistenceService } from '../layout-persistence';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('LayoutPersistenceService', () => {
    let service: LayoutPersistenceService;
    let testDir: string;

    beforeEach(() => {
        testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'openas3d-test-'));
    });

    afterEach(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    /**
     * Bug: Persistence Failure
     * Changes are not saved to disk and lost on next load.
     * This could occur if the persist() method is not called after savePosition.
     */
    test('should persist overrides to disk and load them back in a new session', async () => {
        service = new LayoutPersistenceService(testDir);
        const fileId = 'test/file.ts';
        const posX = 1.234567;
        const posZ = 9.876543;

        // Save position
        await service.savePosition(fileId, posX, posZ);

        // Verify it's in memory (normalized)
        expect(service.getOverride(fileId)).toEqual({ x: 1.235, z: 9.877 });

        // Simulate a new session/process by creating a new service instance
        const newService = new LayoutPersistenceService(testDir);
        const loadedOverride = newService.getOverride(fileId);

        // This would fail if data wasn't actually written to disk
        expect(loadedOverride).toEqual({ x: 1.235, z: 9.877 });
    });

    test('should sort keys alphabetically on save', async () => {
        service = new LayoutPersistenceService(testDir);

        await service.savePosition('b.ts', 1, 1);
        await service.savePosition('a.ts', 2, 2);

        // Check the actual file content on disk
        const layoutFile = path.join(testDir, '.openas3d', 'layout.json');
        const content = JSON.parse(fs.readFileSync(layoutFile, 'utf8'));
        const keys = Object.keys(content.overrides);

        expect(keys).toEqual(['a.ts', 'b.ts']);
    });
});
