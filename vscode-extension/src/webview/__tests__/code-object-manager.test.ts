
import { CodeObjectManager } from '../code-object-manager';
import * as THREE from 'three';
import { FileObject } from '../objects/file-object';
import { SignObject } from '../objects/sign-object';
import { createTextSprite } from '../texture-factory';


// We rely on the __mocks__/three.ts automatically used by jest

// Mock document for canvas actions
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
            fillRect: jest.fn(),
            strokeRect: jest.fn(),
            strokeText: jest.fn(),
            fillText: jest.fn(),
            measureText: jest.fn().mockReturnValue({ width: 0 })
        }),
        width: 0,
        height: 0
    })
};


jest.mock('../texture-factory', () => ({
    renderLabel: jest.fn(() => {
        const sprite = new THREE.Sprite();
        sprite.userData = { width: 1, height: 1 };
        sprite.material = {
            dispose: jest.fn(),
            map: { dispose: jest.fn() }
        } as any;
        return sprite;
    }),
    createTextSprite: jest.fn(() => {
        const sprite = new THREE.Sprite();
        sprite.userData = { width: 1, height: 1 };
        sprite.material = {
            dispose: jest.fn(),
            map: { dispose: jest.fn() }
        } as any;
        return sprite;
    }),
    generateTexture: jest.fn(() => new THREE.CanvasTexture({} as any)),
    createContentTexture: jest.fn(() => new THREE.CanvasTexture({} as any))
}));

describe('CodeObjectManager', () => {
    let scene: THREE.Scene;
    let manager: CodeObjectManager;

    beforeEach(() => {
        jest.clearAllMocks();
        scene = new THREE.Scene();
        manager = new CodeObjectManager(scene);
    });

    describe('addObject', () => {
        it('should create a FileObject for file types', () => {
            manager.addObject({
                id: 'file1',
                type: 'file',
                filePath: '/path/to/file.ts',
                position: { x: 0, y: 0, z: 0 },
                metadata: { lines: 10 }
            });

            expect(manager.getObjectCount()).toBe(1);
            const obj = manager.findByMesh(manager.getObjectMeshes()[0] as THREE.Mesh);
            expect(obj).toBeInstanceOf(FileObject);
            expect(obj?.filePath).toBe('/path/to/file.ts');
        });

        it('should create a SignObject for sign types', () => {
            manager.addObject({
                id: 'sign1',
                type: 'sign',
                filePath: '/path/to/sign1',
                position: { x: 10, y: 0, z: 10 },
                metadata: { description: 'Hello Sign' },
                description: 'Hello Sign'
            });

            expect(manager.getObjectCount()).toBe(1);
            const obj = manager.findByMesh(manager.getObjectMeshes()[0] as THREE.Mesh);
            expect(obj).toBeInstanceOf(SignObject);
            // Verify description pass-through fix
            expect(obj?.metadata.description).toBe('Hello Sign');

            // Verify the texture factory was actually called (catches the "shim" bug where we might return empty sprite without calling factory)
            expect(createTextSprite).toHaveBeenCalledWith('Hello Sign', undefined);
        });

        it('should initialize labels for created objects', () => {
            // Mock FileObject.initializeLabel if it were a real object, 
            // but since we use the real class with mocked THREE, let's verify visual result
            manager.addObject({
                id: 'file2',
                type: 'file',
                filePath: '/file2.ts',
                position: { x: 0, y: 0, z: 0 },
                description: 'test label'
            });

            const obj = manager.findByMesh(manager.getObjectMeshes()[0] as THREE.Mesh);
            // Helper to check if sprite was added to scene
            // Since our mock Scene tracks children
            const hasSprite = scene.children.some(child => child instanceof THREE.Sprite);
            expect(hasSprite).toBe(true);
        });

        it('should float all objects at eye level', () => {
            manager.addObject({
                id: 'obj1',
                type: 'file',
                filePath: '/file.ts',
                position: { x: 0, y: 0, z: 0 },
                size: { width: 1, height: 1, depth: 1 }
            });

            const obj = manager.findByMesh(manager.getObjectMeshes()[0] as THREE.Mesh);
            expect(obj?.mesh.position.y).toBe(3.9); // EYE_LEVEL_Y
        });
    });

    describe('applyDescription', () => {
        it('should update description for FileObject', () => {
            manager.addObject({
                id: 'f1',
                type: 'file',
                filePath: '/f1.ts',
                position: { x: 0, y: 0, z: 0 }
            });

            manager.applyDescription('/f1.ts', {
                summary: 'Updated Summary',
                status: 'generated'
            });

            const obj = manager.getObjects().next().value;
            // Access internal metadata via type assertion or public getter if available
            // In test env we can cast to any
            expect((obj as any).metadata.descriptionStatus).toBe('generated');
        });

        it('should update description for SignObject (Regression Test)', () => {
            manager.addObject({
                id: 's1',
                type: 'sign',
                filePath: '/s1',
                position: { x: 0, y: 0, z: 0 },
                description: 'Original'
            });

            manager.applyDescription('/s1', {
                summary: 'New Text',
                status: 'user-edited'
            });

            // If implementation works, sign should accept the update
            // We can verify by checking if updateLabel was called or side effects
            // Let's check metadata side effect
            const obj = manager.getObjects().next().value;
            expect((obj as any).metadata.descriptionStatus).toBe('user-edited');
        });
    });
});


