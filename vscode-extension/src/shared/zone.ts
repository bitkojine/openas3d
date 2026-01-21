/**
 * Shared Zone definitions used by both Extension (Layout) and Webview (Rendering).
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
 * Calculated Bounds for a Zone (dynamic layout)
 */
export interface ZoneBounds {
    name: string;
    displayName: string;
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    fileCount: number;
    color: number;
}
