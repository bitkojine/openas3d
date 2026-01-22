import { CodeFile } from './types';
import { ZoneConfig, ZoneBounds } from '../core/domain/zone';
import { ZoneClassifier } from './zone-classifier';

export { ZoneConfig, ZoneBounds };

/**
 * Responsible for computing 3D layout positions for files.
 * Organizes files into 8 architecture-based zones with spiral expansion for infinite scalability.
 * 
 * Zone Layout (top view):
 *              NORTH
 *         [entry]   [api]
 *   WEST  [lib]  [core] [data]  EAST
 *         [infra] [ui]  [test]
 *              SOUTH
 * 
 * Zones represent architectural layers:
 * - entry: Application entry points (main, index, CLI)
 * - api: HTTP/RPC handlers, routes, controllers
 * - core: Business logic, domain models, services
 * - data: Database, ORM, repositories
 * - ui: Components, views, layouts, styles
 * - infra: CI/CD, Docker, Kubernetes, deployment
 * - lib: Utilities, helpers, shared code
 * - test: Test files
 */
export class CodebaseLayoutEngine {
    private classifier = new ZoneClassifier();

    private zones: { [key: string]: ZoneConfig } = {
        core: { name: 'core', displayName: 'Core Logic', xCenter: 0, zCenter: 0, spacing: 5.0, color: 0x9b59b6 },  // Purple
        entry: { name: 'entry', displayName: 'Entry Points', xCenter: -25, zCenter: -50, spacing: 5.0, color: 0x3498db },  // Blue
        api: { name: 'api', displayName: 'API Layer', xCenter: 25, zCenter: -50, spacing: 5.0, color: 0x27ae60 },  // Green
        data: { name: 'data', displayName: 'Data Layer', xCenter: 50, zCenter: 0, spacing: 5.0, color: 0xf39c12 },  // Orange
        ui: { name: 'ui', displayName: 'User Interface', xCenter: 0, zCenter: 50, spacing: 5.0, color: 0xe74c3c },  // Red
        infra: { name: 'infra', displayName: 'Infrastructure', xCenter: -50, zCenter: 50, spacing: 5.0, color: 0x95a5a6 },  // Gray
        lib: { name: 'lib', displayName: 'Utilities', xCenter: -50, zCenter: 0, spacing: 5.0, color: 0x00bcd4 },  // Cyan
        test: { name: 'test', displayName: 'Tests', xCenter: 50, zCenter: 50, spacing: 5.0, color: 0x2ecc71 }   // Light Green
    };


    private zoneBounds: Map<string, ZoneBounds> = new Map();

    /**
     * Compute positions for all files in the dependency graph
     */
    public computePositions(files: CodeFile[]): Map<string, { x: number; z: number }> {
        const zoneBuckets: { [zone: string]: CodeFile[] } = {};

        // Initialize zone bounds tracking
        this.zoneBounds.clear();

        files.forEach(file => {
            const zone = this.getZoneForFile(file);
            if (!zoneBuckets[zone]) { zoneBuckets[zone] = []; }
            zoneBuckets[zone].push(file);
        });

        const positions = new Map<string, { x: number; z: number }>();

        Object.entries(zoneBuckets).forEach(([zoneName, filesInZone]) => {
            let minX = Infinity, maxX = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;

            filesInZone.forEach((file, i) => {
                const pos = this.getPositionForZone(zoneName, i);
                positions.set(file.id, pos);

                // Track bounds
                minX = Math.min(minX, pos.x);
                maxX = Math.max(maxX, pos.x);
                minZ = Math.min(minZ, pos.z);
                maxZ = Math.max(maxZ, pos.z);
            });

            const zoneConfig = this.zones[zoneName] || this.zones['other'];

            // Store zone bounds with padding for fences
            const padding = zoneConfig.spacing;
            this.zoneBounds.set(zoneName, {
                name: zoneName,
                displayName: zoneConfig.displayName,
                minX: minX - padding,
                maxX: maxX + padding,
                minZ: minZ - padding,
                maxZ: maxZ + padding,
                fileCount: filesInZone.length,
                color: zoneConfig.color
            });
        });

        return positions;
    }

    /**
     * Get computed zone bounds for sign/fence placement
     */
    public getZoneBounds(): ZoneBounds[] {
        return Array.from(this.zoneBounds.values());
    }

    /**
     * Compute zone bounds from file counts (for streaming mode).
     * Call this instead of getZoneBounds() when using streaming file additions.
     */
    public computeZoneBoundsFromCounts(zoneCounts: { [zone: string]: number }): ZoneBounds[] {
        const bounds: ZoneBounds[] = [];

        Object.entries(zoneCounts).forEach(([zoneName, fileCount]) => {
            if (fileCount === 0) { return; }

            const zoneConfig = this.zones[zoneName] || this.zones['other'];

            // Calculate bounds from spiral positions
            let minX = Infinity, maxX = -Infinity;
            let minZ = Infinity, maxZ = -Infinity;

            for (let i = 0; i < fileCount; i++) {
                const pos = this.getPositionForZone(zoneName, i);
                minX = Math.min(minX, pos.x);
                maxX = Math.max(maxX, pos.x);
                minZ = Math.min(minZ, pos.z);
                maxZ = Math.max(maxZ, pos.z);
            }

            const padding = zoneConfig.spacing;
            bounds.push({
                name: zoneName,
                displayName: zoneConfig.displayName,
                minX: minX - padding,
                maxX: maxX + padding,
                minZ: minZ - padding,
                maxZ: maxZ + padding,
                fileCount,
                color: zoneConfig.color
            });
        });

        return bounds;
    }

    /**
     * Get zone config by name
     */
    public getZoneConfig(zoneName: string): ZoneConfig | undefined {
        return this.zones[zoneName];
    }

    /**
     * Get all zone configs
     */
    public getAllZones(): ZoneConfig[] {
        return Object.values(this.zones);
    }

    /**
     * Determine which zone a file belongs to based on architectural patterns.
     * Delegates to ZoneClassifier.
     */
    public getZoneForFile(file: CodeFile): string {
        return this.classifier.getZoneForFile(file);
    }


    /**
     * Calculate grid position within a zone using spiral expansion.
     * Files are placed in an outward spiral from the zone center,
     * ensuring the zone can grow infinitely.
     */
    public getPositionForZone(zoneName: string, indexInZone: number): { x: number; z: number } {
        const zone = this.zones[zoneName] || this.zones['other'];
        const { x: spiralX, z: spiralZ } = this.spiralPosition(indexInZone);

        return {
            x: zone.xCenter + spiralX * zone.spacing,
            z: zone.zCenter + spiralZ * zone.spacing
        };
    }

    /**
     * Generate spiral coordinates for a given index.
     * Creates an outward-expanding square spiral pattern:
     * 
     *   16 15 14 13 12
     *   17  4  3  2 11
     *   18  5  0  1 10
     *   19  6  7  8  9
     *   20 21 22 23 24
     */
    private spiralPosition(index: number): { x: number; z: number } {
        if (index === 0) { return { x: 0, z: 0 }; }

        // Find which ring we're on (ring 0 = center, ring 1 = first layer, etc.)
        let ring = Math.ceil((Math.sqrt(index + 1) - 1) / 2);

        // How many cells are in rings 0 to (ring-1)?
        const cellsInPreviousRings = (2 * ring - 1) ** 2;
        const positionInRing = index - cellsInPreviousRings;

        // Each ring has 4 sides, each side has (2 * ring) cells
        const sideLength = 2 * ring;
        const side = Math.floor(positionInRing / sideLength);
        const posOnSide = positionInRing % sideLength;

        let x = 0, z = 0;

        switch (side) {
            case 0: // Right side (going up)
                x = ring;
                z = -ring + 1 + posOnSide;
                break;
            case 1: // Top side (going left)
                x = ring - 1 - posOnSide;
                z = ring;
                break;
            case 2: // Left side (going down)
                x = -ring;
                z = ring - 1 - posOnSide;
                break;
            case 3: // Bottom side (going right)
                x = -ring + 1 + posOnSide;
                z = -ring;
                break;
        }

        return { x, z };
    }
}

