import * as THREE from 'three';
import { CodeObjectManager } from '../code-object-manager';
import { VisualObject } from '../objects/visual-object';

export class DraggableObjectController {
    private isDragging = false;
    private draggedObject: VisualObject | null = null;
    private dragPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private intersection = new THREE.Vector3();
    private offset = new THREE.Vector3();

    constructor(
        private objects: CodeObjectManager,
        private camera: THREE.Camera,
        private onMove: (id: string, pos: THREE.Vector3) => void
    ) { }

    public startDrag(visualObject: VisualObject, raycaster: THREE.Raycaster): boolean {
        if (this.isDragging) return false;

        // Calculate intersection with drag plane
        if (raycaster.ray.intersectPlane(this.dragPlane, this.intersection)) {
            this.isDragging = true;
            this.draggedObject = visualObject;

            // Calculate offset between intersection point and object position
            // This prevents the object from snapping to the mouse center
            this.offset.subVectors(visualObject.mesh.position, this.intersection);
            return true;
        }
        return false;
    }

    public update(raycaster: THREE.Raycaster) {
        if (!this.isDragging || !this.draggedObject) return;

        if (raycaster.ray.intersectPlane(this.dragPlane, this.intersection)) {
            // Apply offset
            const targetPos = new THREE.Vector3().addVectors(this.intersection, this.offset);

            // Constrain Y (optional, or allow lifting?)
            // For now, lock Y? No, CodeObjectManager handles Y via 'updateObjectPosition' which respects floating height
            // But we should probably feed the X/Z back.

            this.draggedObject.mesh.position.set(targetPos.x, targetPos.y, targetPos.z);

            // Notify listener (debouncing handled by consumer if needed, or we can debounce here)
            this.onMove(this.draggedObject.id, targetPos);
        }
    }

    public endDrag() {
        this.isDragging = false;
        this.draggedObject = null;
    }

    public getIsDragging(): boolean {
        return this.isDragging;
    }
}
