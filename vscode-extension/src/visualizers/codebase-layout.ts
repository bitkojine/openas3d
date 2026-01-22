import { CodeFile } from './types';
import { ZoneConfig, Zone, ZoneDTO } from '../core/domain/zone';
import { ZoneClassifier } from './zone-classifier';

export { ZoneConfig, Zone, ZoneDTO };

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

    private zones: Map<string, Zone> = new Map();

    constructor() {
        this.initializeZones();
    }

    private initializeZones() {
        const configs: ZoneConfig[] = [
            { name: 'core', displayName: 'Core Logic', xCenter: 0, zCenter: 0, spacing: 5.0, color: 0x9b59b6 },  // Purple
            { name: 'entry', displayName: 'Entry Points', xCenter: -25, zCenter: -50, spacing: 5.0, color: 0x3498db },  // Blue
            { name: 'api', displayName: 'API Layer', xCenter: 25, zCenter: -50, spacing: 5.0, color: 0x27ae60 },  // Green
            { name: 'data', displayName: 'Data Layer', xCenter: 50, zCenter: 0, spacing: 5.0, color: 0xf39c12 },  // Orange
            { name: 'ui', displayName: 'User Interface', xCenter: 0, zCenter: 50, spacing: 5.0, color: 0xe74c3c },  // Red
            { name: 'infra', displayName: 'Infrastructure', xCenter: -50, zCenter: 50, spacing: 5.0, color: 0x95a5a6 },  // Gray
            { name: 'lib', displayName: 'Utilities', xCenter: -50, zCenter: 0, spacing: 5.0, color: 0x00bcd4 },  // Cyan
            { name: 'test', displayName: 'Tests', xCenter: 50, zCenter: 50, spacing: 5.0, color: 0x2ecc71 }   // Light Green
        ];

        configs.forEach(config => {
            this.zones.set(config.name, new Zone(config));
        });
        // Ensure 'other' or fallback exists if needed, or just map unknown to 'core' or 'lib'
        // For now, getZoneForFile returns one of these keys.
    }

    /**
     * Compute positions for all files in the dependency graph
     */
    public computePositions(files: CodeFile[]): Map<string, { x: number; z: number }> {
        // Reset zones
        this.initializeZones();

        const zoneBuckets: { [zone: string]: CodeFile[] } = {};

        files.forEach(file => {
            const zoneName = this.getZoneForFile(file);
            if (!zoneBuckets[zoneName]) { zoneBuckets[zoneName] = []; }
            zoneBuckets[zoneName].push(file);
        });

        const positions = new Map<string, { x: number; z: number }>();

        Object.entries(zoneBuckets).forEach(([zoneName, filesInZone]) => {
            const zone = this.zones.get(zoneName) || this.zones.get('core')!; // Fallback to core

            filesInZone.forEach((file, i) => {
                const pos = this.getPositionForZone(zone, i);
                positions.set(file.id, pos);

                // Update zone bounds
                zone.expandToInclude(pos.x, pos.z);
            });
        });

        return positions;
    }

    /**
     * Get computed zones with their bounds
     */
    public getZones(): Zone[] {
        return Array.from(this.zones.values());
    }

    /**
     * Legacy support: Get computed zone bounds for sign/fence placement
     */
    public getZoneBounds(): ZoneDTO[] {
        return this.getZones().map(z => {
            const b = z.getBounds();
            return {
                name: z.name,
                displayName: z.displayName,
                minX: b.minX, maxX: b.maxX,
                minZ: b.minZ, maxZ: b.maxZ,
                fileCount: z.fileCount,
                color: z.color
            };
        });
    }

    /**
     * Compute zone bounds from file counts (for streaming mode).
     * Call this instead of getZoneBounds() when using streaming file additions.
     */
    public computeZoneBoundsFromCounts(zoneCounts: { [zone: string]: number }): ZoneDTO[] {
        const tempZones: Zone[] = [];

        // Create temp zones just for calculation
        this.zones.forEach(existingZone => {
            const count = zoneCounts[existingZone.name] || 0;
            if (count === 0) return;

            const tempZone = new Zone(existingZone.config);

            for (let i = 0; i < count; i++) {
                const pos = this.getPositionForZone(tempZone, i);
                tempZone.expandToInclude(pos.x, pos.z);
            }
            tempZones.push(tempZone);
        });

        return tempZones.map(z => {
            const b = z.getBounds();
            return {
                name: z.name,
                displayName: z.displayName,
                minX: b.minX, maxX: b.maxX,
                minZ: b.minZ, maxZ: b.maxZ,
                fileCount: z.fileCount,
                color: z.color
            };
        });
    }

    /**
     * Get zone by name
     */
    public getZone(zoneName: string): Zone | undefined {
        return this.zones.get(zoneName);
    }

    /**
     * Get zone config by name
     */
    public getZoneConfig(zoneName: string): ZoneConfig | undefined {
        return this.zones.get(zoneName)?.config;
    }

    /**
     * Get all zone configs
     */
    public getAllZones(): ZoneConfig[] {
        return Array.from(this.zones.values()).map(z => z.config);
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
    public getPositionForZone(zone: Zone, indexInZone: number): { x: number; z: number } {
        // const zone = this.zones[zoneName] || this.zones['other'];
        const { x: spiralX, z: spiralZ } = this.spiralPosition(indexInZone);

        return {
            x: zone.config.xCenter + spiralX * zone.config.spacing,
            z: zone.config.zCenter + spiralZ * zone.config.spacing
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

