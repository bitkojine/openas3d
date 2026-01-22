/**
 * Shared Zone definitions - pure domain types.
 * Used by both Extension (Layout) and Webview (Rendering).
 */

/**
 * Configuration for a Zone (static definition)
 */
export interface ZoneConfig {
    name: string;
    displayName: string;
    xCenter: number;
    zCenter: number;
    spacing: number;
    color: number;
}

/**
 * A architectural zone in the 3D environment.
 * Encapsulates both static configuration and dynamic spatial bounds.
 */
export class Zone {
    public readonly config: ZoneConfig;

    // Dynamic bounds
    private _minX: number = Infinity;
    private _maxX: number = -Infinity;
    private _minZ: number = Infinity;
    private _maxZ: number = -Infinity;
    private _fileCount: number = 0;

    constructor(config: ZoneConfig) {
        this.config = config;
    }

    public get name(): string { return this.config.name; }
    public get displayName(): string { return this.config.displayName; }
    public get color(): number { return this.config.color; }
    public get fileCount(): number { return this._fileCount; }

    /**
     * Expand the zone bounds to include a new position.
     * Automatically handles padding from config.
     */
    public expandToInclude(x: number, z: number): void {
        const padding = this.config.spacing;

        // We track the actual content bounds roughly here, 
        // effectively identifying the extent of the content.
        // But to match previous logic, we store the "padded" bounds directly if desired,
        // or store content bounds and apply padding on getter. 
        // Let's store content bounds and apply padding in getters for cleaner logic, 
        // OR just stick to the previous simple logic: 
        // "minX = Math.min(minX, pos.x)" then "minX - padding" at the end.

        // Let's stick to raw generic bounds update first.
        if (this._fileCount === 0) {
            // First item initializes
            this._minX = x;
            this._maxX = x;
            this._minZ = z;
            this._maxZ = z;
        } else {
            this._minX = Math.min(this._minX, x);
            this._maxX = Math.max(this._maxX, x);
            this._minZ = Math.min(this._minZ, z);
            this._maxZ = Math.max(this._maxZ, z);
        }
        this._fileCount++;
    }

    /**
     * Get the bounds of the zone with padding applied.
     * Returns a format compatible with legacy ZoneBounds if needed.
     */
    public getBounds() {
        if (this._fileCount === 0) {
            // Default small box around center if empty
            const cX = this.config.xCenter;
            const cZ = this.config.zCenter;
            const p = this.config.spacing;
            return {
                minX: cX - p, maxX: cX + p,
                minZ: cZ - p, maxZ: cZ + p
            };
        }

        const padding = this.config.spacing;
        return {
            minX: this._minX - padding,
            maxX: this._maxX + padding,
            minZ: this._minZ - padding,
            maxZ: this._maxZ + padding
        };
    }

    /**
     * Get the center point of the current bounds
     */
    public getCenter(): { x: number, z: number } {
        const b = this.getBounds();
        return {
            x: (b.minX + b.maxX) / 2,
            z: (b.minZ + b.maxZ) / 2
        };
    }
}

/**
 * specialized DTO for serialization if needed, similar to old ZoneBounds
 */
export interface ZoneDTO {
    name: string;
    displayName: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    fileCount: number;
    color: number;
}
