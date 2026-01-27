import { LayoutPersistenceService } from '../layout-persistence';
import * as fs from 'fs';
import * as path from 'path';

jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    promises: {
        writeFile: jest.fn().mockResolvedValue(undefined),
    },
}));
jest.mock('path');

describe('LayoutPersistenceService', () => {
    let service: LayoutPersistenceService;
    const mockRoot = '/mock/root';

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers();
        (path.join as jest.Mock).mockImplementation((...args) => args.join('/'));
        (fs.existsSync as jest.Mock).mockReturnValue(false);
        (fs.readFileSync as jest.Mock).mockReturnValue(undefined); // Reset read behavior
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('should normalize coordinates to 3 decimal places', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue('{}'); // Empty valid JSON
        service = new LayoutPersistenceService(mockRoot);

        await service.savePosition('test/file.ts', 1.234567, 9.876543);

        const override = service.getOverride('test/file.ts');
        expect(override).toEqual({ x: 1.235, z: 9.877 });
    });

    test('should load existing overrides', () => {
        const mockData = {
            version: 1,
            overrides: {
                'existing.ts': { x: 10, z: 20 }
            }
        };
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockData));

        service = new LayoutPersistenceService(mockRoot);

        expect(service.getOverride('existing.ts')).toEqual({ x: 10, z: 20 });
    });

    test('should sort keys alphabetically on save', async () => {
        (fs.existsSync as jest.Mock).mockReturnValue(true);
        (fs.readFileSync as jest.Mock).mockReturnValue('{}'); // valid empty
        service = new LayoutPersistenceService(mockRoot);

        await service.savePosition('b.ts', 1, 1);
        await service.savePosition('a.ts', 2, 2);

        // Advance timers for debounce
        jest.runAllTimers();

        // Need to wait for the async doPersist that was scheduled by the timer
        // We can do this by yielding to the event loop
        await Promise.resolve();

        // Check the LATEST write
        const calls = (fs.promises.writeFile as jest.Mock).mock.calls;
        const lastCall = calls[calls.length - 1];
        const wroteData = JSON.parse(lastCall[1]);
        const keys = Object.keys(wroteData.overrides);

        expect(keys).toEqual(['a.ts', 'b.ts']);
    });
});
