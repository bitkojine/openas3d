/**
 * Zone Visual Elements: Signs and Fences
 * Creates visual markers for zone boundaries in the 3D code park.
 */
import * as THREE from 'three';
import { ZoneDTO } from '../core/domain/zone';
import { createEnhancedGrassTexture, createPathwayTexture } from './environment';
import { ThemeColors } from '../shared/types';
export { ZoneDTO };

/**
 * Configuration for zone signs
 */
const SIGN_CONFIG = {
    postHeight: 2.5,
    postRadius: 0.08,
    boardWidth: 3.0,
    boardHeight: 0.8,
    boardDepth: 0.1,
    fontSize: 48,
    fontFamily: 'Arial, sans-serif'
} as const;

/**
 * Configuration for zone fences
 */
const FENCE_CONFIG = {
    postHeight: 3.0,
    postRadius: 0.15,
    railHeight: 0.15,
    railWidth: 0.1,
    postSpacing: 5.0,
    gapSize: 6.0,            // Gap for pathways
} as const;

/**
 * Create a zone sign with the zone name
 */
export function createZoneSign(zone: ZoneDTO, side: 'north' | 'south' | 'east' | 'west', theme: ThemeColors): THREE.Group {
    const group = new THREE.Group();

    // Wooden post
    const postGeometry = new THREE.CylinderGeometry(
        SIGN_CONFIG.postRadius,
        SIGN_CONFIG.postRadius * 1.2,
        SIGN_CONFIG.postHeight,
        8
    );
    const postMaterial = new THREE.MeshLambertMaterial({ color: theme.signPost });
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.y = SIGN_CONFIG.postHeight / 2;
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);

    // Sign boards (Sandwich style)
    const boardGeometry = new THREE.BoxGeometry(
        SIGN_CONFIG.boardWidth,
        SIGN_CONFIG.boardHeight,
        SIGN_CONFIG.boardDepth
    );

    // Create text texture for sign
    const textTexture = createSignTexture(zone.displayName, theme);
    const boardMaterials = [
        new THREE.MeshLambertMaterial({ color: theme.signBoard }), // right
        new THREE.MeshLambertMaterial({ color: theme.signBoard }), // left
        new THREE.MeshLambertMaterial({ color: theme.signBoard }), // top
        new THREE.MeshLambertMaterial({ color: theme.signBoard }), // bottom
        new THREE.MeshBasicMaterial({ map: textTexture }),         // front
        new THREE.MeshBasicMaterial({ map: textTexture })          // back
    ];

    const yPos = SIGN_CONFIG.postHeight - SIGN_CONFIG.boardHeight / 2 - 0.1;
    const zOffset = SIGN_CONFIG.postRadius + SIGN_CONFIG.boardDepth / 2;

    // Front Board
    const frontBoard = new THREE.Mesh(boardGeometry, boardMaterials);
    frontBoard.position.z = zOffset;
    frontBoard.position.y = yPos;
    frontBoard.castShadow = true;
    frontBoard.receiveShadow = true;
    group.add(frontBoard);

    // Back Board
    const backBoard = new THREE.Mesh(boardGeometry, boardMaterials);
    backBoard.position.z = -zOffset;
    backBoard.position.y = yPos;
    backBoard.rotation.y = Math.PI; // Rotate 180 to face backwards
    backBoard.castShadow = true;
    backBoard.receiveShadow = true;
    group.add(backBoard);

    // Position based on side
    const midX = (zone.minX + zone.maxX) / 2;
    const midZ = (zone.minZ + zone.maxZ) / 2;
    const offset = 2.0;

    switch (side) {
        case 'north':
            group.position.set(midX, 0, zone.minZ - offset);
            break;
        case 'south':
            group.position.set(midX, 0, zone.maxZ + offset);
            group.rotation.y = Math.PI;
            break;
        case 'east':
            group.position.set(zone.maxX + offset, 0, midZ);
            group.rotation.y = -Math.PI / 2;
            break;
        case 'west':
            group.position.set(zone.minX - offset, 0, midZ);
            group.rotation.y = Math.PI / 2;
            break;
    }

    group.userData = { type: 'zoneSign', zoneName: zone.name, side };
    return group;
}

/**
 * Create texture with zone name text
 */
function createSignTexture(text: string, theme: ThemeColors): THREE.Texture {
    const canvas = document.createElement('canvas');
    const width = 512;
    const height = 128;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Uniform dark background for high contrast readability
    ctx.fillStyle = theme.signBoard;
    ctx.fillRect(0, 0, width, height);

    // Light border for visibility
    ctx.strokeStyle = theme.signPost; // Use post color for border
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, width - 6, height - 6);

    // Text
    ctx.fillStyle = theme.signText;
    ctx.font = `bold ${SIGN_CONFIG.fontSize}px ${SIGN_CONFIG.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Add text shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    return texture;
}

/**
 * Create fence segments around a zone boundary
 */
export function createZoneFence(zone: ZoneDTO, theme: ThemeColors): THREE.Group {
    const group = new THREE.Group();

    const postMaterial = new THREE.MeshLambertMaterial({ color: theme.fencePost });
    const railMaterial = new THREE.MeshLambertMaterial({ color: theme.fenceRail });

    // Create fence for each side with gaps for pathways
    createFenceSide(group, zone.minX, zone.minZ, zone.maxX, zone.minZ, postMaterial, railMaterial, 'horizontal');
    createFenceSide(group, zone.minX, zone.maxZ, zone.maxX, zone.maxZ, postMaterial, railMaterial, 'horizontal');
    createFenceSide(group, zone.minX, zone.minZ, zone.minX, zone.maxZ, postMaterial, railMaterial, 'vertical');
    createFenceSide(group, zone.maxX, zone.minZ, zone.maxX, zone.maxZ, postMaterial, railMaterial, 'vertical');

    group.userData = { type: 'zoneFence', zoneName: zone.name };
    return group;
}

/**
 * Create one side of the fence with posts and rails
 */
function createFenceSide(
    group: THREE.Group,
    x1: number, z1: number,
    x2: number, z2: number,
    postMaterial: THREE.MeshLambertMaterial,
    railMaterial: THREE.MeshLambertMaterial,
    orientation: 'horizontal' | 'vertical'
): void {
    const length = orientation === 'horizontal'
        ? Math.abs(x2 - x1)
        : Math.abs(z2 - z1);

    // Calculate gap positions (always perfectly centered)
    const midPoint = length / 2;
    const gapHalf = FENCE_CONFIG.gapSize / 2;
    const gapStart = midPoint - gapHalf;
    const gapEnd = midPoint + gapHalf;

    // Define mandatory post positions: Start, GapStart, GapEnd, End
    // But clamp Gap positions to safeguard against weird small sizes (though logic handles this)
    const mandatoryPosts = [
        0,
        Math.max(0, gapStart),
        Math.min(length, gapEnd),
        length
    ];

    // Create a set of unique post positions
    const uniquePositions = new Set<number>(mandatoryPosts);

    // Fill intervals with intermediate posts
    // Interval 0 -> gapStart
    fillInterval(uniquePositions, 0, Math.max(0, gapStart), FENCE_CONFIG.postSpacing);
    // Interval gapEnd -> length
    fillInterval(uniquePositions, Math.min(length, gapEnd), length, FENCE_CONFIG.postSpacing);

    // Sort positions
    const sortedPosts = Array.from(uniquePositions).sort((a, b) => a - b);

    // Render Posts and Rails
    for (let i = 0; i < sortedPosts.length; i++) {
        const pos = sortedPosts[i];

        // Skip posts strictly INSIDE the gap (shouldn't happen with above logic, but safety check)
        // We include gapStart and gapEnd as valid posts
        if (pos > gapStart + 0.01 && pos < gapEnd - 0.01) {
            continue;
        }

        // Calculate world position
        const t = pos / length;
        const x = x1 + (x2 - x1) * t;
        const z = z1 + (z2 - z1) * t;

        // Render Post
        const postGeometry = new THREE.CylinderGeometry(
            FENCE_CONFIG.postRadius,
            FENCE_CONFIG.postRadius,
            FENCE_CONFIG.postHeight,
            6
        );
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.set(x, FENCE_CONFIG.postHeight / 2, z);
        post.castShadow = true;
        post.receiveShadow = true;
        group.add(post);

        // Render Rail to next post?
        // Check if next post exists and is NOT across the gap
        if (i < sortedPosts.length - 1) {
            const nextPos = sortedPosts[i + 1];

            // If the segment [pos, nextPos] is the gap, skip rails
            // The gap is specifically [gapStart, gapEnd]
            // Because we forcibly added gapStart and gapEnd to the list, 
            // the gap will exactly be one of the segments if gap > 0
            const mid = (pos + nextPos) / 2;
            const inGap = mid > gapStart && mid < gapEnd;

            if (!inGap) {
                const nextT = nextPos / length;
                const nextX = x1 + (x2 - x1) * nextT;
                const nextZ = z1 + (z2 - z1) * nextT;

                const railLength = Math.sqrt(Math.pow(nextX - x, 2) + Math.pow(nextZ - z, 2));

                // Top rail
                const topRailGeometry = new THREE.BoxGeometry(
                    orientation === 'horizontal' ? railLength : FENCE_CONFIG.railWidth,
                    FENCE_CONFIG.railHeight,
                    orientation === 'vertical' ? railLength : FENCE_CONFIG.railWidth
                );
                const topRail = new THREE.Mesh(topRailGeometry, railMaterial);
                topRail.position.set(
                    (x + nextX) / 2,
                    FENCE_CONFIG.postHeight * 0.8,
                    (z + nextZ) / 2
                );
                topRail.castShadow = true;
                group.add(topRail);

                // Bottom rail
                const bottomRailGeometry = new THREE.BoxGeometry(
                    orientation === 'horizontal' ? railLength : FENCE_CONFIG.railWidth,
                    FENCE_CONFIG.railHeight,
                    orientation === 'vertical' ? railLength : FENCE_CONFIG.railWidth
                );
                const bottomRail = new THREE.Mesh(bottomRailGeometry, railMaterial);
                bottomRail.position.set(
                    (x + nextX) / 2,
                    FENCE_CONFIG.postHeight * 0.3,
                    (z + nextZ) / 2
                );
                bottomRail.castShadow = true;
                group.add(bottomRail);
            }
        }
    }
}

function fillInterval(positions: Set<number>, start: number, end: number, spacing: number) {
    const dist = end - start;
    if (dist <= 0) return;

    // Determine how many segments fit
    const count = Math.ceil(dist / spacing);
    const actualSpacing = dist / count;

    for (let i = 1; i < count; i++) {
        positions.add(start + i * actualSpacing);
    }
}

/**
 * Add all zone visual elements to the scene
 */
export function addZoneVisuals(scene: THREE.Scene, zones: ZoneDTO[], theme: ThemeColors): THREE.Group {
    const visualsGroup = new THREE.Group();
    visualsGroup.name = 'zoneVisuals';

    zones.forEach(zone => {
        // Only add visuals for zones with files
        if (zone.fileCount > 0) {
            // Add signs for all 4 directions
            visualsGroup.add(createZoneSign(zone, 'north', theme));
            visualsGroup.add(createZoneSign(zone, 'south', theme));
            visualsGroup.add(createZoneSign(zone, 'east', theme));
            visualsGroup.add(createZoneSign(zone, 'west', theme));

            const fence = createZoneFence(zone, theme);
            visualsGroup.add(fence);

            // Add Grass Floor for the Zone
            const width = zone.maxX - zone.minX;
            const depth = zone.maxZ - zone.minZ;

            // Only create floor if zone has valid dimensions
            if (width > 0 && depth > 0) {
                const grassTexture = createEnhancedGrassTexture(theme);
                // Adjust repeat based on size to keep scale consistent
                grassTexture.repeat.set(width / 20, depth / 20);

                const floorGeometry = new THREE.PlaneGeometry(width, depth);
                const floorMaterial = new THREE.MeshLambertMaterial({
                    map: grassTexture,
                    transparent: false
                });

                const floor = new THREE.Mesh(floorGeometry, floorMaterial);
                floor.rotation.x = -Math.PI / 2;
                // Position slightly above global path (y=-0.01) to sit on top
                floor.position.set((zone.minX + zone.maxX) / 2, 0.02, (zone.minZ + zone.maxZ) / 2);
                floor.receiveShadow = true;

                visualsGroup.add(floor);
            }
        }
    });

    scene.add(visualsGroup);
    return visualsGroup;
}

/**
 * Create a simple paved foundation for the park area
 */
export function createParkFoundation(zones: ZoneDTO[], theme?: ThemeColors): THREE.Mesh | null {
    if (zones.length === 0) return null;

    // Calculate bounds of entire park
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    zones.forEach(z => {
        minX = Math.min(minX, z.minX);
        maxX = Math.max(maxX, z.maxX);
        minZ = Math.min(minZ, z.minZ);
        maxZ = Math.max(maxZ, z.maxZ);
    });

    // Add padding for outer pathway loop
    const padding = 10;
    const width = (maxX - minX) + padding * 2;
    const height = (maxZ - minZ) + padding * 2;
    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;

    const geometry = new THREE.PlaneGeometry(width, height);
    const texture = createPathwayTexture(theme);

    // Adjust texture repeat based on size
    texture.repeat.set(width / 10, height / 10);

    const material = new THREE.MeshLambertMaterial({
        map: texture,
        transparent: false
    });

    const foundation = new THREE.Mesh(geometry, material);
    foundation.rotation.x = -Math.PI / 2;
    foundation.position.set(centerX, -0.05, centerZ); // Between global grass (-0.2) and zones (0.02)
    foundation.receiveShadow = true;
    foundation.name = 'parkFoundation';

    return foundation;
}

/**
 * Remove all zone visuals from scene
 */
export function removeZoneVisuals(scene: THREE.Scene): void {
    const existing = scene.getObjectByName('zoneVisuals');
    if (existing) {
        scene.remove(existing);
        // Dispose geometries and materials
        existing.traverse((obj) => {
            if (obj instanceof THREE.Mesh) {
                obj.geometry.dispose();
                const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
                materials.forEach(m => m.dispose());
            }
        });
    }
}

/**
 * Determine which zone a position is in
 */
export function getZoneAtPosition(x: number, z: number, zones: ZoneDTO[]): ZoneDTO | null {
    for (const zone of zones) {
        if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) {
            return zone;
        }
    }
    return null;
}
