/**
 * Zone Visual Elements: Signs and Fences
 * Creates visual markers for zone boundaries in the 3D code park.
 */
import * as THREE from 'three';

/**
 * Zone bounds data received from extension.
 * Must match ZoneBounds from codebase-layout.ts
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

/**
 * Configuration for zone signs
 */
const SIGN_CONFIG = {
    postHeight: 2.5,
    postRadius: 0.08,
    postColor: 0x5d4037,      // Brown wood
    boardWidth: 3.0,
    boardHeight: 0.8,
    boardDepth: 0.1,
    boardColor: 0x8d6e63,     // Light wood
    textColor: '#ffffff',
    fontSize: 48,
    fontFamily: 'Arial, sans-serif'
} as const;

/**
 * Configuration for zone fences
 */
const FENCE_CONFIG = {
    postHeight: 0.8,
    postRadius: 0.05,
    railHeight: 0.03,
    railWidth: 0.05,
    postSpacing: 4.0,
    gapSize: 6.0,            // Gap for pathways
    postColor: 0x6d4c41,     // Dark wood
    railColor: 0x8d6e63      // Light wood
} as const;

/**
 * Create a zone sign with the zone name
 */
export function createZoneSign(zone: ZoneBounds): THREE.Group {
    const group = new THREE.Group();

    // Wooden post
    const postGeometry = new THREE.CylinderGeometry(
        SIGN_CONFIG.postRadius,
        SIGN_CONFIG.postRadius * 1.2,
        SIGN_CONFIG.postHeight,
        8
    );
    const postMaterial = new THREE.MeshLambertMaterial({ color: SIGN_CONFIG.postColor });
    const post = new THREE.Mesh(postGeometry, postMaterial);
    post.position.y = SIGN_CONFIG.postHeight / 2;
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);

    // Sign board
    const boardGeometry = new THREE.BoxGeometry(
        SIGN_CONFIG.boardWidth,
        SIGN_CONFIG.boardHeight,
        SIGN_CONFIG.boardDepth
    );

    // Create text texture for sign
    const textTexture = createSignTexture(zone.displayName, zone.color);
    const boardMaterials = [
        new THREE.MeshLambertMaterial({ color: SIGN_CONFIG.boardColor }), // right
        new THREE.MeshLambertMaterial({ color: SIGN_CONFIG.boardColor }), // left
        new THREE.MeshLambertMaterial({ color: SIGN_CONFIG.boardColor }), // top
        new THREE.MeshLambertMaterial({ color: SIGN_CONFIG.boardColor }), // bottom
        new THREE.MeshBasicMaterial({ map: textTexture }),                 // front
        new THREE.MeshBasicMaterial({ map: textTexture })                  // back
    ];

    const board = new THREE.Mesh(boardGeometry, boardMaterials);
    board.position.y = SIGN_CONFIG.postHeight - SIGN_CONFIG.boardHeight / 2 - 0.1;
    board.castShadow = true;
    board.receiveShadow = true;
    group.add(board);

    // Position at the north edge of the zone (entrance)
    group.position.set(
        (zone.minX + zone.maxX) / 2,
        0,
        zone.minZ - 2
    );

    group.userData = { type: 'zoneSign', zoneName: zone.name };
    return group;
}

/**
 * Create texture with zone name text
 */
function createSignTexture(text: string, accentColor: number): THREE.Texture {
    const canvas = document.createElement('canvas');
    const width = 512;
    const height = 128;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // Background with zone color accent
    const colorHex = '#' + accentColor.toString(16).padStart(6, '0');
    ctx.fillStyle = colorHex;
    ctx.fillRect(0, 0, width, height);

    // Darker border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.lineWidth = 8;
    ctx.strokeRect(4, 4, width - 8, height - 8);

    // Text
    ctx.fillStyle = SIGN_CONFIG.textColor;
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
export function createZoneFence(zone: ZoneBounds): THREE.Group {
    const group = new THREE.Group();

    const postMaterial = new THREE.MeshLambertMaterial({ color: FENCE_CONFIG.postColor });
    const railMaterial = new THREE.MeshLambertMaterial({ color: FENCE_CONFIG.railColor });

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

    const numPosts = Math.floor(length / FENCE_CONFIG.postSpacing) + 1;
    const midPoint = numPosts / 2;
    const gapStart = midPoint - 0.5;
    const gapEnd = midPoint + 0.5;

    for (let i = 0; i < numPosts; i++) {
        // Skip posts in the gap area (pathway)
        if (i >= gapStart && i <= gapEnd) { continue; }

        const t = numPosts > 1 ? i / (numPosts - 1) : 0;
        const x = x1 + (x2 - x1) * t;
        const z = z1 + (z2 - z1) * t;

        // Create post
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

        // Create rail to next post (if not at gap or end)
        if (i < numPosts - 1 && !(i >= gapStart - 1 && i < gapEnd)) {
            const nextT = (i + 1) / (numPosts - 1);
            const nextX = x1 + (x2 - x1) * nextT;
            const nextZ = z1 + (z2 - z1) * nextT;

            const railLength = Math.sqrt(
                Math.pow(nextX - x, 2) + Math.pow(nextZ - z, 2)
            );

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

/**
 * Add all zone visual elements to the scene
 */
export function addZoneVisuals(scene: THREE.Scene, zones: ZoneBounds[]): THREE.Group {
    const visualsGroup = new THREE.Group();
    visualsGroup.name = 'zoneVisuals';

    zones.forEach(zone => {
        // Only add visuals for zones with files
        if (zone.fileCount > 0) {
            const sign = createZoneSign(zone);
            visualsGroup.add(sign);

            const fence = createZoneFence(zone);
            visualsGroup.add(fence);
        }
    });

    scene.add(visualsGroup);
    return visualsGroup;
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
export function getZoneAtPosition(x: number, z: number, zones: ZoneBounds[]): ZoneBounds | null {
    for (const zone of zones) {
        if (x >= zone.minX && x <= zone.maxX && z >= zone.minZ && z <= zone.maxZ) {
            return zone;
        }
    }
    return null;
}
