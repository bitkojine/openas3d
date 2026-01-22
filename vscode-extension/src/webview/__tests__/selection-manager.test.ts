
import { SelectionManager } from '../selection-manager';
import * as THREE from 'three';
import { VisualObject } from '../objects/visual-object';

// Mock VisualObject
class MockVisualObject extends VisualObject {
    protected createMesh(): THREE.Mesh {
        return new THREE.Mesh(
            new THREE.BoxGeometry(),
            new THREE.MeshLambertMaterial()
        );
    }
    public update(data: any): void { }
}

describe('SelectionManager', () => {
    let scene: THREE.Scene;
    let manager: SelectionManager;
    let obj1: MockVisualObject;
    let obj2: MockVisualObject;

    beforeEach(() => {
        scene = new THREE.Scene();
        manager = new SelectionManager(scene);
        obj1 = new MockVisualObject('1', 'file', new THREE.Vector3());
        obj2 = new MockVisualObject('2', 'file', new THREE.Vector3());
    });

    it('should select an object', () => {
        const spy = jest.spyOn(obj1, 'select');
        manager.selectObject(obj1);
        expect(manager.getSelectedVisualObject()).toBe(obj1);
        expect(spy).toHaveBeenCalled();
    });

    it('should deselect the current object when selecting another', () => {
        manager.selectObject(obj1);
        const spyDeselect = jest.spyOn(obj1, 'deselect');
        const spySelect = jest.spyOn(obj2, 'select');

        manager.selectObject(obj2);

        expect(spyDeselect).toHaveBeenCalled();
        expect(spySelect).toHaveBeenCalled();
        expect(manager.getSelectedVisualObject()).toBe(obj2);
    });

    it('should deselect object', () => {
        manager.selectObject(obj1);
        const spy = jest.spyOn(obj1, 'deselect');

        manager.deselectObject();

        expect(manager.getSelectedVisualObject()).toBeNull();
        expect(spy).toHaveBeenCalled();
    });

    it('should handle focus separately', () => {
        manager.setFocusedObject(obj1);
        expect(manager.getFocusedObject()).toBeDefined();

        manager.selectObject(obj2);
        // Focus should remain distinct from selection unless logic enforces otherwise
        expect(manager.getSelectedVisualObject()).toBe(obj2);
    });
});
