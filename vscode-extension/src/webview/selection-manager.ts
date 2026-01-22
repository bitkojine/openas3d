import * as THREE from 'three';
import { VisualObject } from './objects/visual-object';
import { CodeEntityDTO } from './types';

/**
 * Manages selection and focus state of objects in the 3D scene.
 */
export class SelectionManager {
    private selectedObject: VisualObject | null = null;
    private focusedObject: VisualObject | null = null;

    constructor(private scene: THREE.Scene) { }

    /**
     * Select a specific object.
     * Highlights the object and updates internal state.
     */
    public selectObject(obj: VisualObject): void {
        if (this.selectedObject === obj) { return; }

        if (this.selectedObject) {
            this.selectedObject.deselect(); // Was setHighlight(false)
        }

        this.selectedObject = obj;
        this.selectedObject.select(); // Was setHighlight(true)
    }

    /**
     * Deselect the currently selected object.
     */
    public deselectObject(): void {
        if (this.selectedObject) {
            this.selectedObject.deselect(); // Was setHighlight(false)
            this.selectedObject = null;
        }
    }

    /**
     * Get the currently selected object data DTO.
     */
    public getSelectedObject(): CodeEntityDTO | null {
        return this.selectedObject ? this.selectedObject.toCodeEntityDTO() : null;
    }

    /**
     * Get the internal VisualObject that is selected.
     * (Internal use only)
     */
    public getSelectedVisualObject(): VisualObject | null {
        return this.selectedObject;
    }

    /**
     * Set the focused object (e.g. from mouse hover).
     */
    public setFocusedObject(obj: VisualObject | null): void {
        if (this.focusedObject === obj) { return; }

        if (this.focusedObject) {
            this.focusedObject.setHighlight(false);
        }

        this.focusedObject = obj;

        if (this.focusedObject) {
            this.focusedObject.setHighlight(true);
        }
    }

    /**
     * Get the currently focused object data DTO.
     */
    public getFocusedObject(): CodeEntityDTO | null {
        return this.focusedObject ? this.focusedObject.toCodeEntityDTO() : null;
    }

    /**
     * Update animations (if we add selection pulses etc).
     */
    public update(_deltaTime: number): void {
        // Placeholder for future animated selection effects
    }
}
