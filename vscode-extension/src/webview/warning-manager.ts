import { ArchitectureWarning } from '../core/analysis/types';
import { VisualObject } from './objects/visual-object';
import { FileObject } from './objects/file-object';

/**
 * Manages architecture warnings in the 3D scene.
 * Applies warning badges to objects.
 */
export class WarningManager {
    private activeWarnings: ArchitectureWarning[] = [];

    constructor() { }

    /**
     * Set the current list of architecture warnings.
     * Updates the visual badges on all affected objects.
     */
    public setWarnings(warnings: ArchitectureWarning[], objects: Map<string, VisualObject>): void {
        this.activeWarnings = warnings;

        // Clear all existing badges first
        for (const obj of objects.values()) {
            if (obj instanceof FileObject) {
                obj.setWarningBadge(null);
            }
        }

        // Apply new badges
        const warningsByFile = this.groupWarningsByFile(warnings);

        for (const [fileId, fileWarnings] of warningsByFile) {
            const obj = objects.get(fileId);
            if (obj && obj instanceof FileObject) {
                obj.setWarningBadge(fileWarnings);
            }
        }
    }

    /**
     * Helper to group warnings by file ID.
     */
    private groupWarningsByFile(warnings: ArchitectureWarning[]): Map<string, ArchitectureWarning[]> {
        const map = new Map<string, ArchitectureWarning[]>();

        for (const warning of warnings) {
            const fileId = warning.fileId;
            if (!map.has(fileId)) {
                map.set(fileId, []);
            }
            map.get(fileId)?.push(warning);
        }

        return map;
    }

    public getWarningCount(): number {
        return this.activeWarnings.length;
    }
}
