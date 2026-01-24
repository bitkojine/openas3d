import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { LayoutPersistenceService } from '../../services/layout-persistence';

suite('LayoutPersistenceService Test Suite', () => {
    let testDir: string;
    let persistenceService: LayoutPersistenceService;

    setup(() => {
        testDir = path.join(os.tmpdir(), 'openas3d-test-' + Date.now());
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        persistenceService = new LayoutPersistenceService(testDir);
    });

    teardown(() => {
        if (fs.existsSync(testDir)) {
            fs.rmSync(testDir, { recursive: true, force: true });
        }
    });

    test('Should save and load position overrides', async () => {
        const fileId = 'src/test.ts';
        const posX = 10.5;
        const posZ = 20.7;

        await persistenceService.savePosition(fileId, posX, posZ);

        // Check if file was created
        const layoutFile = path.join(testDir, '.openas3d', 'layout.json');
        assert.strictEqual(fs.existsSync(layoutFile), true, 'layout.json should be created');

        // Verify content
        const content = JSON.parse(fs.readFileSync(layoutFile, 'utf8'));
        assert.strictEqual(content.overrides[fileId].x, 10.5);
        assert.strictEqual(content.overrides[fileId].z, 20.7);

        // Load into a new service instance
        const newService = new LayoutPersistenceService(testDir);
        const override = newService.getOverride(fileId);
        assert.ok(override, 'Override should be loaded');
        assert.strictEqual(override?.x, 10.5);
        assert.strictEqual(override?.z, 20.7);
    });

    test('Should normalize precision when saving', async () => {
        const fileId = 'src/math.ts';
        await persistenceService.savePosition(fileId, 1.234567, 9.876543);

        const override = persistenceService.getOverride(fileId);
        assert.strictEqual(override?.x, 1.235); // 3 decimal places
        assert.strictEqual(override?.z, 9.877);
    });

    test('Should handle missing workspace root gracefully', async () => {
        const headlessService = new LayoutPersistenceService();
        await headlessService.savePosition('test', 0, 0);
        assert.strictEqual(headlessService.getOverride('test')?.x, 0);
        // Should not crash or create files
    });
});
