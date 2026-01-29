import { SelectionManager } from '../selection-manager';
import { ThemeColors } from '../../shared/types';
import * as THREE from 'three';
import { VisualObject } from '../objects/visual-object';

// Mock VisualObject that tracks its own state
class MockVisualObject extends VisualObject {
    public isSelected = false;
    public isHighlighted = false;

    protected createMesh(): THREE.Mesh {
        return new THREE.Mesh(
            new THREE.BoxGeometry(),
            new THREE.MeshLambertMaterial()
        );
    }

    public select(): void {
        this.isSelected = true;
    }

    public deselect(): void {
        this.isSelected = false;
    }

    public setHighlight(highlighted: boolean): void {
        this.isHighlighted = highlighted;
    }

    public update(data: any): void { }
    public updateTheme(theme: ThemeColors): void { }

    public toDTO(): any {
        return {
            id: this.id,
            type: this.type,
            position: this.position,
            filePath: this.filePath || '',
            metadata: this.metadata
        };
    }
}

describe('SelectionManager (Behavioral)', () => {
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

    it('should select an object and notify it', () => {
        manager.selectObject(obj1);
        expect(manager.getSelectedVisualObject()).toBe(obj1);
        expect(obj1.isSelected).toBe(true);
    });

    it('should deselect the current object when selecting another', () => {
        manager.selectObject(obj1);
        expect(obj1.isSelected).toBe(true);

        manager.selectObject(obj2);

        expect(obj1.isSelected).toBe(false);
        expect(obj2.isSelected).toBe(true);
        expect(manager.getSelectedVisualObject()).toBe(obj2);
    });

    it('should deselect object through manager', () => {
        manager.selectObject(obj1);
        expect(obj1.isSelected).toBe(true);

        manager.deselectObject();

        expect(manager.getSelectedVisualObject()).toBeNull();
        expect(obj1.isSelected).toBe(false);
    });

    it('should handle focus independently of selection', () => {
        manager.setFocusedObject(obj1);
        expect(obj1.isHighlighted).toBe(true);

        manager.selectObject(obj2);

        // Selection shouldn't automatically drop focus on a different object 
        // in this manager's current implementation
        expect(obj1.isHighlighted).toBe(true);
        expect(obj2.isSelected).toBe(true);
        expect(obj2.isHighlighted).toBe(false);
    });

    it('should update focus when a new object is focused', () => {
        manager.setFocusedObject(obj1);
        expect(obj1.isHighlighted).toBe(true);

        manager.setFocusedObject(obj2);
        expect(obj1.isHighlighted).toBe(false);
        expect(obj2.isHighlighted).toBe(true);
    });

    it('should clear focus', () => {
        manager.setFocusedObject(obj1);
        manager.setFocusedObject(null);
        expect(obj1.isHighlighted).toBe(false);
    });
});
