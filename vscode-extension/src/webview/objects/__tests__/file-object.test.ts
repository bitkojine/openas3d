import * as THREE from 'three';
import { FileObject } from '../file-object';

// Mocks
jest.mock('../../../utils/languageRegistry', () => ({
    getLanguageColor: jest.fn().mockReturnValue(0xff0000)
}));

jest.mock('../../texture-factory', () => ({
    createContentTexture: jest.fn().mockReturnValue(new THREE.CanvasTexture(null as any)),
    createTextSprite: jest.fn().mockReturnValue(new THREE.Sprite()),
    createTextSpriteWithDeps: jest.fn().mockReturnValue(new THREE.Sprite())
}));

describe('FileObject', () => {
    let fileObject: FileObject;
    const mockData = {
        id: 'test-file',
        type: 'file',
        metadata: {
            filePath: '/path/to/file.ts',
            language: 'typescript',
            content: 'console.log("hello");',
            size: 1024
        },
        size: { width: 1, height: 2, depth: 1 }
    };

    beforeEach(() => {
        const position = new THREE.Vector3(0, 0, 0);
        fileObject = new FileObject('test-id', 'file', position, mockData);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should create a composite mesh structure', () => {
        // Root should be a Mesh (hitbox)
        expect(fileObject.mesh).toBeInstanceOf(THREE.Mesh);

        // Should have children (Frame, Screens, etc)
        // We expect at least: Frame, Front Screen, Back Screen, Status Bar
        expect(fileObject.mesh.children.length).toBeGreaterThanOrEqual(4);
    });

    test('should have a specific structure for children', () => {
        const children = fileObject.mesh.children;

        // Helper to find by userData or name if we set them, 
        // but since we haven't implemented names yet, we'll check geometry types if possible
        // or just ensure they are Meshes
        children.forEach(child => {
            expect(child).toBeInstanceOf(THREE.Mesh);
        });
    });

    test('getHeight should return correct height from root bounding box', () => {
        // Mock bounding box for the root mesh
        fileObject.mesh.geometry.boundingBox = {
            min: { x: -0.5, y: -1, z: -0.5 },
            max: { x: 0.5, y: 1, z: 0.5 }
        } as any;

        const height = fileObject.getHeight();
        expect(height).toBe(2);
    });

    test('dispose should clean up children', () => {
        const disposeSpy = jest.spyOn(fileObject.mesh.geometry, 'dispose');

        // Mock children disposal
        const childDisposeSpies = fileObject.mesh.children.map(child => {
            const mesh = child as THREE.Mesh;
            // Ensure geometry exists on mock
            if (!mesh.geometry) mesh.geometry = { dispose: jest.fn() } as any;
            if (!mesh.material) mesh.material = { dispose: jest.fn() } as any;

            return {
                geometry: jest.spyOn(mesh.geometry, 'dispose'),
                material: jest.spyOn(mesh.material as any, 'dispose')
            };
        });

        fileObject.dispose();

        expect(disposeSpy).toHaveBeenCalled();
        childDisposeSpies.forEach(spies => {
            expect(spies.geometry).toHaveBeenCalled();
            expect(spies.material).toHaveBeenCalled();
        });
    });
    test('should set userData.visualObject on all children for interaction', () => {
        const checkUserData = (obj: THREE.Object3D) => {
            if (obj instanceof THREE.Mesh) {
                expect(obj.userData.visualObject).toBe(fileObject);
            }
            obj.children.forEach(checkUserData);
        };
        checkUserData(fileObject.mesh);
    });

    test('frame mesh should have a texture map', () => {
        // Frame is the first child in our implementation (index 0)
        const frameMesh = fileObject.mesh.children[0] as THREE.Mesh;
        expect(frameMesh).toBeDefined();
        // It uses MeshLambertMaterial
        const material = frameMesh.material as THREE.MeshLambertMaterial;
        expect(material.map).toBeDefined(); // Should have the tech texture
    });
});
