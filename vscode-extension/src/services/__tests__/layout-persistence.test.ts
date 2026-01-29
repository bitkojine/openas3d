import { LayoutPersistenceService } from '../layout-persistence';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('LayoutPersistenceService (Behavioral)', () => {
    let service: LayoutPersistenceService;
    let baseTempDir: string;
    let testCounter = 0;

    beforeAll(() => {
        baseTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'layout-persistence-test-'));
    });

    afterAll(() => {
        fs.rmSync(baseTempDir, { recursive: true, force: true });
    });

    const getFreshTestDir = () => {
        const dir = path.join(baseTempDir, `test-${testCounter++}`);
        fs.mkdirSync(dir);
        return dir;
    };

    it('should normalize coordinates to 3 decimal places in a real file', async () => {
        const testDir = getFreshTestDir();
        service = new LayoutPersistenceService(testDir);

        const fileId = 'test/file.ts';
        await service.savePosition(fileId, 1.234567, 9.876543);

        const override = service.getOverride(fileId);
        expect(override).toEqual({ x: 1.235, z: 9.877 });

        // Verify the file content on disk
        const layoutPath = path.join(testDir, '.openas3d', 'layout.json');
        expect(fs.existsSync(layoutPath)).toBe(true);

        const content = fs.readFileSync(layoutPath, 'utf8');
        const data = JSON.parse(content);
        expect(data.overrides[fileId]).toEqual({ x: 1.235, z: 9.877 });
    });

    it('should load existing overrides from a real file', () => {
        const testDir = getFreshTestDir();
        const mockData = {
            version: 1,
            overrides: {
                'existing.ts': { x: 10, z: 20 }
            }
        };
        const dirPath = path.join(testDir, '.openas3d');
        fs.mkdirSync(dirPath, { recursive: true });
        fs.writeFileSync(path.join(dirPath, 'layout.json'), JSON.stringify(mockData));

        service = new LayoutPersistenceService(testDir);

        expect(service.getOverride('existing.ts')).toEqual({ x: 10, z: 20 });
    });

    it('should sort keys alphabetically on save in a real file', async () => {
        const testDir = getFreshTestDir();
        service = new LayoutPersistenceService(testDir);

        await service.savePosition('b.ts', 1, 1);
        await service.savePosition('a.ts', 2, 2);

        // Check the LATEST write
        const layoutPath = path.join(testDir, '.openas3d', 'layout.json');
        const data = JSON.parse(fs.readFileSync(layoutPath, 'utf8'));
        const keys = Object.keys(data.overrides);

        expect(keys).toEqual(['a.ts', 'b.ts']);
    });
});
