import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

interface LayoutOverride {
    x: number;
    z: number;
}

interface LayoutFile {
    version: number;
    overrides: { [fileId: string]: LayoutOverride };
}

/**
 * Manages the persistence of manual layout overrides.
 * Stores data in .openas3d/layout.json within the workspace.
 */
export class LayoutPersistenceService {
    private readonly DIR_NAME = '.openas3d';
    private readonly FILE_NAME = 'layout.json';
    private overrides: Map<string, LayoutOverride> = new Map();
    private workspaceRoot: string | undefined;

    constructor(workspaceRoot?: string) {
        this.workspaceRoot = workspaceRoot;
        this.load();
    }

    /**
     * Set the workspace root (if not available at construction)
     */
    public setWorkspaceRoot(root: string) {
        this.workspaceRoot = root;
        this.load();
    }

    /**
     * Get a position override for a file, if it exists.
     */
    public getOverride(fileId: string): LayoutOverride | undefined {
        return this.overrides.get(fileId);
    }

    /**
     * Save a new position for a file.
     * @param fileId Relative path to the file (stable ID)
     * @param x X Coordinate
     * @param z Z Coordinate
     */
    public async savePosition(fileId: string, x: number, z: number): Promise<void> {
        // precision normalization: keep 3 decimal places
        const normalizedX = Number(x.toFixed(3));
        const normalizedZ = Number(z.toFixed(3));

        this.overrides.set(fileId, { x: normalizedX, z: normalizedZ });
        await this.persist();
    }

    /**
     * Load from disk
     */
    private load() {
        if (!this.workspaceRoot) {
            return;
        }

        const layoutPath = path.join(this.workspaceRoot, this.DIR_NAME, this.FILE_NAME);
        if (fs.existsSync(layoutPath)) {
            try {
                const content = fs.readFileSync(layoutPath, 'utf8');
                const data = JSON.parse(content) as LayoutFile;

                this.overrides.clear();
                if (data.overrides) {
                    Object.entries(data.overrides).forEach(([key, val]) => {
                        this.overrides.set(key, val);
                    });
                }
            } catch (e) {
                console.error('Failed to load layout.json', e);
            }
        }
    }

    /**
     * Write to disk with normalization
     */
    private async persist() {
        if (!this.workspaceRoot) {
            return;
        }

        const dirPath = path.join(this.workspaceRoot, this.DIR_NAME);
        const filePath = path.join(dirPath, this.FILE_NAME);

        // Ensure directory exists
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        // Sort keys for deterministic output
        const sortedOverrides: { [key: string]: LayoutOverride } = {};
        const sortedKeys = Array.from(this.overrides.keys()).sort();

        sortedKeys.forEach(key => {
            sortedOverrides[key] = this.overrides.get(key)!;
        });

        const fileData: LayoutFile = {
            version: 1,
            overrides: sortedOverrides
        };

        // Write with generic pretty-print
        fs.writeFileSync(filePath, JSON.stringify(fileData, null, 2), 'utf8');
    }
}
