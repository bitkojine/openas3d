import { CodeFile } from '../core/domain/code-file';
import { ZoneConfig, Zone, ZoneDTO } from '../core/domain/zone';
import { ZoneClassifier } from './zone-classifier';
import { profile } from '../utils/profiling';
import { LayoutPersistenceService } from '../services/layout-persistence';

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
    private persistenceService?: LayoutPersistenceService;

    constructor(persistenceService?: LayoutPersistenceService) {
        this.persistenceService = persistenceService;
        this.initializeZones();
    }

    private initializeZones() {
        const configs: ZoneConfig[] = [
            { name: 'core', displayName: 'Core Logic', xCenter: 0, zCenter: 0, spacing: 5.0, color: 0x9b59b6 },  // Purple
            { name: 'entry', displayName: 'Entry Points', xCenter: 0, zCenter: 0, spacing: 5.0, color: 0x3498db },  // Blue
            { name: 'api', displayName: 'API Layer', xCenter: 0, zCenter: 0, spacing: 5.0, color: 0x27ae60 },  // Green
            { name: 'data', displayName: 'Data Layer', xCenter: 0, zCenter: 0, spacing: 5.0, color: 0xf39c12 },  // Orange
            { name: 'ui', displayName: 'User Interface', xCenter: 0, zCenter: 0, spacing: 5.0, color: 0xe74c3c },  // Red
            { name: 'infra', displayName: 'Infrastructure', xCenter: 0, zCenter: 0, spacing: 5.0, color: 0x95a5a6 },  // Gray
            { name: 'lib', displayName: 'Utilities', xCenter: 0, zCenter: 0, spacing: 5.0, color: 0x00bcd4 },  // Cyan
            { name: 'test', displayName: 'Tests', xCenter: 0, zCenter: 0, spacing: 5.0, color: 0x2ecc71 }   // Light Green
        ];

        configs.forEach(config => {
            this.zones.set(config.name, new Zone(config));
        });
    }

    /**
     * Compute positions for all files in the dependency graph
     */
    @profile('CodebaseLayoutEngine.computePositions')
    public computePositions(files: CodeFile[]): Map<string, { x: number; z: number }> {
        // Reset zones to default
        this.initializeZones();

        const zoneBuckets: { [zone: string]: CodeFile[] } = {};

        // 1. Bucket files
        files.forEach(file => {
            const zoneName = this.getZoneForFile(file);
            if (!zoneBuckets[zoneName]) { zoneBuckets[zoneName] = []; }
            zoneBuckets[zoneName].push(file);
        });

        // 2. Calculate dynamic layout based on counts
        const zoneCounts: { [zone: string]: number } = {};
        Object.keys(zoneBuckets).forEach(k => zoneCounts[k] = zoneBuckets[k].length);
        this.calculateZoneLayout(zoneCounts);

        const positions = new Map<string, { x: number; z: number }>();

        // 3. Place files
        Object.entries(zoneBuckets).forEach(([zoneName, filesInZone]) => {
            const zone = this.zones.get(zoneName) || this.zones.get('core')!;

            filesInZone.forEach((file, i) => {
                // Check override first
                // Use workspace relative path as ID if possible, otherwise existing ID
                // File.id is usually the relative path in this codebase? need to check, but assumed yes or persistence needs ID
                if (this.persistenceService) {
                    const override = this.persistenceService.getOverride(file.id);
                    if (override) {
                        positions.set(file.id, override);
                        // Update zone bounds even for override? 
                        // Yes, to ensure camera frames it? Or maybe not?
                        // Let's expand zone to include manual items for now so they aren't off-screen
                        zone.expandToInclude(override.x, override.z);
                        return; // Skip procedural placement
                    }
                }

                const pos = this.getPositionForZone(zone, i);
                positions.set(file.id, pos);

                // Update zone bounds
                zone.expandToInclude(pos.x, pos.z);
            });
        });

        return positions;
    }

    /**
     * Dynamically calculate zone centers based on file counts.
     * Uses a weighted grid approach to pack zones tightly but safely.
     */
    @profile('CodebaseLayoutEngine.calculateZoneLayout')
    private calculateZoneLayout(counts: { [zone: string]: number }) {
        const PATH_GAP = 24.0; // Wide pathways (approx 6m)
        const SPACING = 5.0;

        // Helper to get radius of a zone based on count
        const getRadius = (zoneName: string): number => {
            const count = counts[zoneName] || 0;
            if (count === 0) return 0;
            // Ring count ~ sqrt(N)/2. Radius = Ring * Spacing
            const rings = Math.ceil((Math.sqrt(count + 1) - 1) / 2);
            // Add a small buffer (1 unit) to ensure fit
            return (rings + 1) * SPACING;
        };

        const r = {
            core: getRadius('core'),
            entry: getRadius('entry'),
            api: getRadius('api'),
            data: getRadius('data'),
            ui: getRadius('ui'),
            infra: getRadius('infra'),
            lib: getRadius('lib'),
            test: getRadius('test')
        };

        // Layout Schema:
        // [Entry] [ API ]
        // [ Lib ] [Core ] [Data ]
        // [Infra] [ UI  ] [Test ]

        // Core is at (0,0)

        // Column X Offsets
        const xLeft = -(r.core + PATH_GAP + Math.max(r.lib, r.entry, r.infra));
        const xRight = +(r.core + PATH_GAP + Math.max(r.data, r.api, r.test));

        // Row Z Offsets
        const zNorth = -(r.core + PATH_GAP + Math.max(r.entry, r.api));
        const zSouth = +(r.core + PATH_GAP + Math.max(r.ui, r.infra, r.test));

        // Update Zone Configs
        const setCenter = (name: string, x: number, z: number) => {
            const zone = this.zones.get(name);
            if (zone) {
                zone.config.xCenter = x;
                zone.config.zCenter = z;
            }
        };

        setCenter('core', 0, 0);

        // North Row
        setCenter('entry', xLeft, zNorth);
        setCenter('api', xRight, zNorth); // API usually fits better on right to balance? Or center-north? 
        // Let's allow API to be Top-Right.
        // Wait, standard grid is 3x3.
        // If Entry is (-1, -1) and API is (+1, -1), we have a gap at (0, -1).
        // Let's adjust slightly:
        // Entry at Top-Left, API at Top-Right.

        // Middle Row
        setCenter('lib', xLeft, 0);
        setCenter('data', xRight, 0);

        // South Row
        setCenter('infra', xLeft, zSouth); // Infra Bottom-Left
        setCenter('ui', 0, zSouth);       // UI Bottom-Center (often large)
        setCenter('test', xRight, zSouth);// Test Bottom-Right

        // Refined adjustment:
        // entry: North-West
        // api: North-East
        // But what about North-Center?
        // Let's put API North-Center if it's large? No, stick to grid.
        // Actually, if UI is South-Center, we can put API North-Center?
        // The implementation plan said:
        // Row -1 (North): entry, api
        // entry is usually smaller. api can be large.

        // Let's place API at (0, zNorth) if it fits? 
        // No, Keep simple grid for now.
        // Entry -> (-1, -1) => xLeft, zNorth
        // API -> (1, -1) => xRight, zNorth
        // This leaves (0, -1) empty. That's fine, it makes 'Core' stand out.
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
        // Reset zones to ensure clean state
        this.initializeZones();

        // Calculate dynamic layout based on provided counts
        this.calculateZoneLayout(zoneCounts);

        const tempZones: Zone[] = [];

        // Create temp zones just for calculation
        this.zones.forEach(existingZone => {
            const count = zoneCounts[existingZone.name] || 0;
            if (count === 0) return;

            // existingZone.config has now been updated by calculateZoneLayout
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

