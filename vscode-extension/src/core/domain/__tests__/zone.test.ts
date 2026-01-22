
import { Zone, ZoneConfig } from '../zone';

describe('Zone', () => {
    const mockConfig: ZoneConfig = {
        name: 'test-zone',
        displayName: 'Test Zone',
        xCenter: 100,
        zCenter: 100,
        spacing: 10,
        color: 0xffffff
    };

    it('initializes with config values', () => {
        const zone = new Zone(mockConfig);
        expect(zone.name).toBe('test-zone');
        expect(zone.displayName).toBe('Test Zone');
        expect(zone.color).toBe(0xffffff);
        expect(zone.fileCount).toBe(0);
    });

    it('returns default bounds around center when empty', () => {
        const zone = new Zone(mockConfig);
        const bounds = zone.getBounds();

        // Should be center +/- spacing
        expect(bounds.minX).toBe(90); // 100 - 10
        expect(bounds.maxX).toBe(110); // 100 + 10
        expect(bounds.minZ).toBe(90);
        expect(bounds.maxZ).toBe(110);
    });

    it('expands to include points', () => {
        const zone = new Zone(mockConfig);

        // Add first point: (120, 120)
        zone.expandToInclude(120, 120);

        expect(zone.fileCount).toBe(1);

        let bounds = zone.getBounds();
        // Bounds should be point +/- spacing
        expect(bounds.minX).toBe(110); // 120 - 10
        expect(bounds.maxX).toBe(130); // 120 + 10

        // Add second point: (130, 130)
        zone.expandToInclude(130, 130);
        expect(zone.fileCount).toBe(2);

        bounds = zone.getBounds();
        // Bounds should encompass both points + spacing
        // minX was 120 (from first p), now min of (120, 130) is 120
        // maxX was 120 (from first p), now max of (120, 130) is 130

        // Wait, logic is:
        // _minX initialized to first point x.
        // subsequent points expand it.

        // 1st point (120). _minX=120, _maxX=120.
        // 2nd point (130). _minX=120, _maxX=130.

        // Bounds returns _minX-padding, _maxX+padding.
        expect(bounds.minX).toBe(110); // 120 - 10
        expect(bounds.maxX).toBe(140); // 130 + 10
    });

    it('calculates center based on content', () => {
        const zone = new Zone(mockConfig);
        zone.expandToInclude(0, 0);
        zone.expandToInclude(100, 100);

        const center = zone.getCenter();
        // Bounds: minX = 0-10 = -10, maxX = 100+10 = 110.
        // CenterX = (-10 + 110) / 2 = 50.
        expect(center.x).toBe(50);
        expect(center.z).toBe(50);
    });
});
