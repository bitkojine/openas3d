import * as THREE from 'three';
import { CodeObjectManager } from '../code-object-manager';
import { VisualObject } from '../objects/visual-object';

export class DraggableObjectController {
    private isDragging = false;
    private draggedObject: VisualObject | null = null;
    private initialDistance = 0;
    private initialY = 0;

    constructor(
        private objects: CodeObjectManager,
        private camera: THREE.Camera,
        private onMove: (id: string, pos: THREE.Vector3) => void
    ) { }

    public startDrag(visualObject: VisualObject, raycaster: THREE.Raycaster): boolean {
        if (this.isDragging) {return false;}

        this.isDragging = true;
        this.draggedObject = visualObject;

        // Store initial height to lock Y movement
        this.initialY = visualObject.mesh.position.y;

        // Maintain the distance from the camera to the object center at grab time.
        // This is robust at all viewing angles (unlike plane intersections).
        this.initialDistance = this.camera.position.distanceTo(visualObject.mesh.position);

        // Optional: snap the center to the ray immediately
        this.update(raycaster);

        return true;
    }

    public update(raycaster: THREE.Raycaster) {
        if (!this.isDragging || !this.draggedObject) {return;}

        // Project the current ray forward by the initial distance.
        // This keeps the object at a consistent distance from the player
        // and perfectly aligned with the crosshair (ray center).
        const targetPos = new THREE.Vector3()
            .copy(this.camera.position)
            .add(raycaster.ray.direction.clone().multiplyScalar(this.initialDistance));

        // Enforce Y lock to prevent the object from moving up or down
        targetPos.y = this.initialY;

        this.draggedObject.mesh.position.copy(targetPos);

        // Notify listener. 
        // Note: CodeObjectManager usually clamps the Y component to floating height.
        this.onMove(this.draggedObject.id, targetPos);
    }

    public endDrag() {
        this.isDragging = false;
        this.draggedObject = null;
    }

    public getIsDragging(): boolean {
        return this.isDragging;
    }
}
