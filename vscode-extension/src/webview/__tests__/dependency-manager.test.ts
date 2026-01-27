
import { DependencyManager, DependencyData } from '../dependency-manager';
import * as THREE from 'three';
import { VisualObject } from '../objects/visual-object';

// Mock THREE
// jest.mock('three'); // Rely on manual mock in __mocks__/three.ts

// Mock getFlowTexture helper if needed by mocking the module?
// Or global document.createElement canvas mock
(global as any).document = {
    createElement: jest.fn().mockReturnValue({
        getContext: jest.fn().mockReturnValue({
            createLinearGradient: jest.fn().mockReturnValue({
                addColorStop: jest.fn()
            }),
            create: jest.fn(),
            beginPath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            stroke: jest.fn(),
            fillRect: jest.fn()
        }),
        width: 0,
        height: 0
    })
};

describe('DependencyManager', () => {
    let scene: THREE.Scene;
    let manager: DependencyManager;
    let objects: Map<string, VisualObject>;

    beforeEach(() => {
        jest.clearAllMocks();
        scene = new THREE.Scene();
        manager = new DependencyManager(scene);
        objects = new Map();
    });

    // Helper to create mock visual object
    function createMockObject(id: string, x: number, y: number, z: number): VisualObject {
        const mesh = new THREE.Mesh();
        mesh.position.set(x, y, z);

        // Mock minimal interface needed
        const obj = {
            id,
            mesh,
            position: mesh.position, // Important for shared ref
            type: 'file',
            filePath: id,
            dispose: jest.fn(),
            getHeight: jest.fn().mockReturnValue(1.0),
            promote: jest.fn(),
            demote: jest.fn()
        } as unknown as VisualObject;

        return obj;
    }

    it('should add dependency line between two objects', () => {
        const objA = createMockObject('a', 0, 0, 0);
        const objB = createMockObject('b', 10, 0, 0);
        objects.set('a', objA);
        objects.set('b', objB);

        manager.add({
            id: 'd1',
            source: 'a',
            target: 'b',
            type: 'import'
        }, objects);

        expect(manager.getDependencyCount()).toBe(1);
        expect(scene.children.length).toBeGreaterThan(0); // Tube group added
    });

    it('should track stats correctly', () => {
        const objA = createMockObject('a', 0, 0, 0);
        const objB = createMockObject('b', 10, 0, 0);
        objects.set('a', objA);
        objects.set('b', objB);

        manager.add({
            id: 'd1',
            source: 'a',
            target: 'b',
            type: 'import'
        }, objects);

        const statsA = manager.getStatsForObject('a');
        const statsB = manager.getStatsForObject('b');

        expect(statsA.outgoing).toBe(1);
        expect(statsA.incoming).toBe(0);

        expect(statsB.outgoing).toBe(0);
        expect(statsB.incoming).toBe(1);
    });

    it('should detect circular dependencies in stats', () => {
        const objA = createMockObject('a', 0, 0, 0);
        const objB = createMockObject('b', 10, 0, 0);
        objects.set('a', objA);
        objects.set('b', objB);

        manager.add({
            id: 'd1',
            source: 'a',
            target: 'b',
            type: 'import',
            isCircular: true
        }, objects);

        const stats = manager.getStatsForObject('a');
        expect(stats.circularWith).toContain('b');
        expect(manager.getCircularCount()).toBe(0);
        // Note: verify if getCircularCount counts edges or pairs. Logic says count++. If loop is A<->B and represented as 2 edges? 
        // Actually analyzer sends dependencies. A cycle A->B->A usually means 2 edges.
        // If one edge is marked isCircular=true (which the analyzer does for all edges in a cycle), then count increments.
        // Logic: count++; return Math.floor(count / 2);
        // So 1 edge marked circular -> returns 0?
        // Let's check logic:
        // if (dep.isCircular) count++;
        // return Math.floor(count/2);
        // So if only ONE dependency is added and marked circular, result is 0.
        // Wait, "Circular dependency" implies at least 2 edges or self-loop.
        // Analyzer logic: marks edges in cycle.
        // If we add just one edge 'd1' with isCircular=true, count=1, result=0.
        // So let's add the return edge.

        manager.add({
            id: 'd2',
            source: 'b',
            target: 'a',
            type: 'import',
            isCircular: true
        }, objects);

        expect(manager.getCircularCount()).toBe(1); // 2 edges / 2 = 1 cycle (approx)
    });

    it('should remove dependency', () => {
        const objA = createMockObject('a', 0, 0, 0);
        const objB = createMockObject('b', 10, 0, 0);
        objects.set('a', objA);
        objects.set('b', objB);

        manager.add({
            id: 'd1', // id is string
            source: 'a',
            target: 'b',
            type: 'import'
        }, objects);

        expect(manager.getDependencyCount()).toBe(1);

        manager.remove('d1');

        expect(manager.getDependencyCount()).toBe(0);
        // Logic for removing mesh from scene?
        // Scene children check might depend on how many children were there initially (0).
        // It should be 0 again (or minimal if lights/etc were there, but scene is empty in test)
        expect(scene.children.length).toBe(0);
    });

    it('should update dependency lines when object moves', () => {
        const objA = createMockObject('a', 0, 0, 0);
        const objB = createMockObject('b', 10, 0, 0);
        objects.set('a', objA);
        objects.set('b', objB);

        manager.add({
            id: 'd1',
            source: 'a',
            target: 'b',
            type: 'import'
        }, objects);

        // Move object A
        objA.position.set(5, 5, 5);
        if (objA.mesh) objA.mesh.position.copy(objA.position);

        // Update dependencies
        manager.updateObjectPosition('a', objects);

        // Check if dependency still exists
        expect(manager.getDependencyCount()).toBe(1);

        // We can't easily check the geometry vertices without deep inspection,
        // but we can check that a group exists in the scene
        expect(scene.children.length).toBe(1);
    });
});
