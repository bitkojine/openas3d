import * as THREE from 'three';

/**
 * Manages THREE.InstancedMesh pools for high-performance rendering of many objects.
 */
export class InstanceManager {
    private fileBodyInstances: THREE.InstancedMesh;
    private fileCapInstances: THREE.InstancedMesh;

    // Map of object ID to instance index
    private idToIndex = new Map<string, number>();
    private indexToId: string[] = [];
    private nextFreeIndex = 0;

    private readonly MAX_INSTANCES: number;

    constructor(scene: THREE.Scene, maxInstances: number = 100000) {
        this.MAX_INSTANCES = maxInstances;

        // 1. Base Geometry for Files
        // Matching FileObject.STRICT_WIDTH (1.5) and default height (1.0)
        // We will scale the instances individually for different heights.
        const bodyGeo = new THREE.BoxGeometry(1.5, 1.0, 0.1);
        const bodyMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
        this.fileBodyInstances = new THREE.InstancedMesh(bodyGeo, bodyMat, maxInstances);
        this.fileBodyInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.fileBodyInstances.castShadow = true;
        this.fileBodyInstances.receiveShadow = true;
        scene.add(this.fileBodyInstances);

        // 2. Cap Geometry (Language/Filename bars)
        // Bar Height = 0.4
        const capGeo = new THREE.BoxGeometry(1.5 + 0.1, 0.4, 0.101);
        const capMat = new THREE.MeshLambertMaterial({ color: 0x666666 });
        this.fileCapInstances = new THREE.InstancedMesh(capGeo, capMat, maxInstances * 2); // 2 caps per file
        this.fileCapInstances.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(this.fileCapInstances);

        // Initialize all to invisible/scaled to 0
        const dummy = new THREE.Object3D();
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        for (let i = 0; i < maxInstances; i++) {
            this.fileBodyInstances.setMatrixAt(i, dummy.matrix);
        }
        for (let i = 0; i < maxInstances * 2; i++) {
            this.fileCapInstances.setMatrixAt(i, dummy.matrix);
        }
    }

    public addInstance(id: string, position: THREE.Vector3, height: number, color?: number): number {
        if (this.nextFreeIndex >= this.MAX_INSTANCES) {
            console.error('InstanceManager: Max instances reached!');
            return -1;
        }

        const index = this.nextFreeIndex++;
        this.idToIndex.set(id, index);
        this.indexToId[index] = id;

        this.updateInstance(id, position, height, color);
        return index;
    }

    public updateInstance(id: string, position: THREE.Vector3, height: number, color?: number): void {
        const index = this.idToIndex.get(id);
        if (index === undefined) return;

        const dummy = new THREE.Object3D();

        // 1. Update Body
        dummy.position.copy(position);
        dummy.scale.set(1, height, 1);
        dummy.updateMatrix();
        this.fileBodyInstances.setMatrixAt(index, dummy.matrix);
        if (color !== undefined) {
            this.fileBodyInstances.setColorAt(index, new THREE.Color(color));
        }

        // 2. Update Caps
        const capHeight = 0.4;
        const totalHeight = height + 0.1;

        // Top Cap
        dummy.position.set(position.x, position.y + (totalHeight / 2) + (capHeight / 2), position.z);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        this.fileCapInstances.setMatrixAt(index * 2, dummy.matrix);

        // Bottom Cap
        dummy.position.set(position.x, position.y - ((totalHeight / 2) + (capHeight / 2)), position.z);
        dummy.updateMatrix();
        this.fileCapInstances.setMatrixAt(index * 2 + 1, dummy.matrix);

        this.fileBodyInstances.instanceMatrix.needsUpdate = true;
        this.fileCapInstances.instanceMatrix.needsUpdate = true;
        if (color !== undefined && this.fileBodyInstances.instanceColor) {
            this.fileBodyInstances.instanceColor.needsUpdate = true;
        }
    }

    public setVisibility(id: string, visible: boolean): void {
        const index = this.idToIndex.get(id);
        if (index === undefined) return;

        if (!visible) {
            // "Hide" by scaling to zero
            const dummy = new THREE.Object3D();
            dummy.scale.set(0, 0, 0);
            dummy.updateMatrix();
            this.fileBodyInstances.setMatrixAt(index, dummy.matrix);
            this.fileCapInstances.setMatrixAt(index * 2, dummy.matrix);
            this.fileCapInstances.setMatrixAt(index * 2 + 1, dummy.matrix);
        } else {
            // Caller should probably call updateInstance to restore correct transform
        }

        this.fileBodyInstances.instanceMatrix.needsUpdate = true;
        this.fileCapInstances.instanceMatrix.needsUpdate = true;
    }

    public dispose(): void {
        this.fileBodyInstances.geometry.dispose();
        (this.fileBodyInstances.material as THREE.Material).dispose();
        this.fileCapInstances.geometry.dispose();
        (this.fileCapInstances.material as THREE.Material).dispose();
    }
}
