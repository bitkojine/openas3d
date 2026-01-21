import * as path from 'path';
import { CodeFile } from './types';

/**
 * Zone configuration for file layout
 */
interface ZoneConfig {
    xStart: number;
    zStart: number;
    columns: number;
    spacing: number;
}

/**
 * Responsible for computing 3D layout positions for files.
 * Organizes files into zones based on their type (source, docs, configs, etc.)
 */
export class CodebaseLayoutEngine {
    private zones: { [key: string]: ZoneConfig } = {
        source: { xStart: -20, zStart: -10, columns: 8, spacing: 3 },
        docs: { xStart: -20, zStart: 10, columns: 8, spacing: 3 },
        configs: { xStart: 20, zStart: -10, columns: 6, spacing: 3 },
        build: { xStart: 20, zStart: 10, columns: 6, spacing: 3 },
        other: { xStart: -40, zStart: 30, columns: 5, spacing: 3 }
    };

    /**
     * Compute positions for all files in the dependency graph
     */
    public computePositions(files: CodeFile[]): Map<string, { x: number; z: number }> {
        const zoneBuckets: { [zone: string]: CodeFile[] } = {};

        files.forEach(file => {
            const zone = this.getZoneForFile(file);
            if (!zoneBuckets[zone]) {zoneBuckets[zone] = [];}
            zoneBuckets[zone].push(file);
        });

        const positions = new Map<string, { x: number; z: number }>();
        Object.entries(zoneBuckets).forEach(([zone, filesInZone]) => {
            filesInZone.forEach((file, i) => {
                const pos = this.getPositionForZone(zone, i);
                positions.set(file.id, pos);
            });
        });

        return positions;
    }

    /**
     * Determine which zone a file belongs to based on its extension and path
     */
    public getZoneForFile(file: CodeFile): string {
        const ext = path.extname(file.filePath).toLowerCase();
        if (['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.go', '.csharp', '.cpp', '.c', '.h'].includes(ext)) {
            return 'source';
        }
        if (['.md'].includes(ext)) {
            return 'docs';
        }
        if (['.json', '.yaml', '.yml', '.toml'].includes(ext)) {
            return 'configs';
        }
        if (file.filePath.includes('dist') || file.filePath.includes('build') || file.filePath.includes('out')) {
            return 'build';
        }
        return 'other';
    }

    /**
     * Calculate grid position within a zone
     */
    public getPositionForZone(zoneName: string, indexInZone: number): { x: number; z: number } {
        const zone = this.zones[zoneName] || this.zones['other'];
        const row = Math.floor(indexInZone / zone.columns);
        const col = indexInZone % zone.columns;
        const x = zone.xStart + col * zone.spacing;
        const z = zone.zStart + row * zone.spacing;
        return { x, z };
    }
}
