
import { CodeObjectManager } from '../code-object-manager';
import * as THREE from 'three';
import { FileObject } from '../objects/file-object';
import { SignObject } from '../objects/sign-object';


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

            const obj = manager.getObject('file1');
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

            const obj = manager.getObject('sign1');
            expect(obj).toBeInstanceOf(SignObject);
            expect(obj?.metadata.description).toBe('Hello Sign');

            // Promote to check texture factory calls
            obj?.promote(scene);

            const { createTextSprite } = require('../texture-factory');
            expect(createTextSprite).toHaveBeenCalledWith('Hello Sign', undefined);
        });

        it('should initialize labels for created objects', () => {
            manager.addObject({
                id: 'file2',
                type: 'file',
                filePath: '/file2.ts',
                position: { x: 0, y: 0, z: 0 },
                description: 'test label'
            });

            const obj = manager.getObject('file2');
            obj?.promote(scene);

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

            const obj = manager.getObject('obj1');
            expect(obj?.position.y).toBe(3.9); // EYE_LEVEL_Y
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

            const obj = manager.getObjects()[0];
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
            const obj = manager.getObjects()[0];
            expect((obj as any).metadata.descriptionStatus).toBe('user-edited');
        });
    });
});


