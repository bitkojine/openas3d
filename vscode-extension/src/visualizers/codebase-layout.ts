import * as path from 'path';
import { CodeFile } from './types';
import { ZoneConfig, ZoneBounds } from '../shared/zone';

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
     * 
     * Priority order (highest to lowest):
     * 1. Tests - explicitly marked test files
     * 2. Entry Points - main/index files, CLI handlers
     * 3. API Layer - routes, controllers, handlers
     * 4. Data Layer - models, schemas, repositories
     * 5. UI Layer - components, views, styles
     * 6. Infrastructure - CI/CD, Docker, K8s
     * 7. Utilities - utils, helpers, lib
     * 8. Core - business logic (fallback for source files)
     */
    public getZoneForFile(file: CodeFile): string {
        const ext = path.extname(file.filePath).toLowerCase();
        const lowerPath = file.filePath.toLowerCase();
        const basename = path.basename(file.filePath).toLowerCase();
        const basenameNoExt = path.basename(file.filePath, ext).toLowerCase();

        // ========================================
        // 1. TESTS - highest priority
        // ========================================
        if (lowerPath.includes('.test.') ||
            lowerPath.includes('.spec.') ||
            lowerPath.includes('__tests__') ||
            lowerPath.includes('/test/') ||
            lowerPath.includes('/tests/') ||
            basename.endsWith('.test.ts') ||
            basename.endsWith('.test.js') ||
            basename.endsWith('.spec.ts') ||
            basename.endsWith('.spec.js')) {
            return 'test';
        }

        // ========================================
        // 2. INFRASTRUCTURE - CI/CD, Docker, K8s
        // ========================================
        if (lowerPath.includes('.github/') ||
            lowerPath.includes('.gitlab-ci') ||
            lowerPath.includes('ci/') ||
            lowerPath.includes('cd/') ||
            lowerPath.includes('docker') ||
            lowerPath.includes('k8s/') ||
            lowerPath.includes('kubernetes/') ||
            lowerPath.includes('helm/') ||
            lowerPath.includes('terraform/') ||
            lowerPath.includes('ansible/') ||
            lowerPath.includes('deploy/') ||
            lowerPath.includes('infra/') ||
            basename.startsWith('dockerfile') ||
            basename === 'docker-compose.yml' ||
            basename === 'docker-compose.yaml' ||
            basename.endsWith('.dockerfile') ||
            ['.tf', '.tfvars'].includes(ext)) {
            return 'infra';
        }

        // ========================================
        // 3. ENTRY POINTS - main files, CLI, app bootstrapping
        // ========================================
        const entryPatterns = ['main', 'index', 'app', 'server', 'cli', 'bin', 'entry', 'bootstrap', 'startup'];
        if (entryPatterns.includes(basenameNoExt) ||
            lowerPath.includes('/bin/') ||
            lowerPath.includes('/cmd/') ||
            lowerPath.includes('/cli/') ||
            lowerPath.startsWith('bin/') ||
            lowerPath.startsWith('cmd/') ||
            lowerPath.startsWith('cli/')) {
            // Only for source-like files
            if (['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.rb', '.php'].includes(ext)) {
                return 'entry';
            }
        }


        // ========================================
        // 4. API LAYER - routes, controllers, handlers
        // ========================================
        if (lowerPath.includes('/api/') ||
            lowerPath.includes('/routes/') ||
            lowerPath.includes('/route/') ||
            lowerPath.includes('/controllers/') ||
            lowerPath.includes('/controller/') ||
            lowerPath.includes('/handlers/') ||
            lowerPath.includes('/handler/') ||
            lowerPath.includes('/endpoints/') ||
            lowerPath.includes('/resolvers/') ||
            lowerPath.includes('/graphql/') ||
            lowerPath.includes('/rest/') ||
            lowerPath.includes('/rpc/') ||
            basename.includes('controller') ||
            basename.includes('handler') ||
            basename.includes('route') ||
            basename.includes('endpoint')) {
            return 'api';
        }

        // ========================================
        // 5. DATA LAYER - models, schemas, repositories
        // ========================================
        if (lowerPath.includes('/models/') ||
            lowerPath.includes('/model/') ||
            lowerPath.includes('/schemas/') ||
            lowerPath.includes('/schema/') ||
            lowerPath.includes('/entities/') ||
            lowerPath.includes('/entity/') ||
            lowerPath.includes('/repositories/') ||
            lowerPath.includes('/repository/') ||
            lowerPath.includes('/repos/') ||
            lowerPath.includes('/dao/') ||
            lowerPath.includes('/migrations/') ||
            lowerPath.includes('/database/') ||
            lowerPath.includes('/db/') ||
            lowerPath.includes('/orm/') ||
            lowerPath.includes('/prisma/') ||
            basename.includes('model') ||
            basename.includes('schema') ||
            basename.includes('entity') ||
            basename.includes('repository') ||
            basename.includes('migration') ||
            ['.prisma', '.sql'].includes(ext)) {
            return 'data';
        }

        // ========================================
        // 6. UI LAYER - components, views, styles
        // ========================================
        if (lowerPath.includes('/components/') ||
            lowerPath.includes('/component/') ||
            lowerPath.includes('/views/') ||
            lowerPath.includes('/view/') ||
            lowerPath.includes('/pages/') ||
            lowerPath.includes('/page/') ||
            lowerPath.includes('/layouts/') ||
            lowerPath.includes('/layout/') ||
            lowerPath.includes('/screens/') ||
            lowerPath.includes('/ui/') ||
            lowerPath.includes('/widgets/') ||
            lowerPath.includes('/templates/') ||
            lowerPath.includes('/styles/') ||
            lowerPath.includes('/css/') ||
            lowerPath.includes('/scss/') ||
            basename.includes('component') ||
            basename.includes('view') ||
            basename.includes('page') ||
            basename.includes('layout') ||
            basename.includes('screen') ||
            ['.css', '.scss', '.sass', '.less', '.styl'].includes(ext) ||
            ['.tsx', '.jsx'].includes(ext)) { // React/Vue components
            return 'ui';
        }

        // ========================================
        // 7. UTILITIES - helpers, shared code
        // ========================================
        if (lowerPath.includes('/utils/') ||
            lowerPath.includes('/util/') ||
            lowerPath.includes('/helpers/') ||
            lowerPath.includes('/helper/') ||
            lowerPath.includes('/lib/') ||
            lowerPath.includes('/libs/') ||
            lowerPath.includes('/common/') ||
            lowerPath.includes('/shared/') ||
            lowerPath.includes('/tools/') ||
            lowerPath.includes('/utilities/') ||
            basename.includes('util') ||
            basename.includes('helper') ||
            basename.includes('common') ||
            basename.includes('constants') ||
            basename.includes('config') ||
            ['.json', '.yaml', '.yml', '.toml', '.ini', '.env'].includes(ext)) {
            return 'lib';
        }

        // ========================================
        // 8. CORE - business logic, services, domain
        // ========================================
        if (lowerPath.includes('/services/') ||
            lowerPath.includes('/service/') ||
            lowerPath.includes('/domain/') ||
            lowerPath.includes('/core/') ||
            lowerPath.includes('/business/') ||
            lowerPath.includes('/logic/') ||
            lowerPath.includes('/managers/') ||
            lowerPath.includes('/providers/') ||
            basename.includes('service') ||
            basename.includes('manager') ||
            basename.includes('provider') ||
            basename.includes('use-case') ||
            basename.includes('usecase')) {
            return 'core';
        }

        // ========================================
        // FALLBACK: Source files -> core, others -> lib
        // ========================================
        if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go',
            '.cs', '.cpp', '.c', '.h', '.hpp', '.rs', '.rb', '.php'].includes(ext)) {
            return 'core';
        }

        return 'lib';
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
