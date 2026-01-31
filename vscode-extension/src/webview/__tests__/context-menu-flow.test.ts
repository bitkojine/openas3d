
// Set up global mocks for the DOM environment
const createMockElement = (tag: string): unknown => {
    const el: unknown = {
        tagName: tag.toUpperCase(),
        style: {} as Record<string, string>,
        classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() },
        children: [] as unknown[],
        appendChild: jest.fn((child: { parentElement?: unknown }) => {
            (el as { children: unknown[] }).children.push(child);
            child.parentElement = el;
            return child;
        }),
        remove: jest.fn(() => {
            const element = el as { parentElement?: { children: unknown[] } };
            if (element.parentElement) {
                const idx = element.parentElement.children.indexOf(el);
                if (idx > -1) element.parentElement.children.splice(idx, 1);
            }
        }),
        getBoundingClientRect: jest.fn(() => ({ top: 0, left: 0, right: 0, bottom: 0, width: 100, height: 100 })),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        requestPointerLock: jest.fn(),
        contains: jest.fn(() => false)
    };
    return el;
};

(global as unknown as { document: unknown }).document = {
    createElement: jest.fn((tag: string) => createMockElement(tag)),
    body: createMockElement('body'),
    pointerLockElement: null,
    exitPointerLock: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    // Simple query selector for test verification
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => [])
};

(global as unknown as { window: unknown }).window = {
    innerWidth: 1000,
    innerHeight: 1000
};

(global as unknown as { MouseEvent: unknown }).MouseEvent = class MouseEvent {
    preventDefault = jest.fn();
    constructor(_type: string, props: object) {
        Object.assign(this, props);
    }
};

// Mock THREE.js
jest.mock('three', () => {
    return {
        Raycaster: jest.fn().mockImplementation(() => ({
            setFromCamera: jest.fn(),
            intersectObjects: jest.fn().mockReturnValue([])
        })),
        Vector2: jest.fn().mockImplementation(() => ({
            set: jest.fn()
        })),
        Vector3: jest.fn().mockImplementation(() => ({
            add: jest.fn(),
            multiplyScalar: jest.fn(),
            copy: jest.fn().mockReturnThis()
        })),
        PerspectiveCamera: jest.fn(),
        Scene: jest.fn(),
        Mesh: jest.fn(),
        BoxGeometry: jest.fn(),
        MeshBasicMaterial: jest.fn(),
        Plane: jest.fn(),
    };
});

import * as THREE from 'three';
import { InteractionController } from '../interaction-controller';
import { CodeObjectManager } from '../code-object-manager';
import { SelectionManager } from '../selection-manager';
import { DraggableObjectController } from '../controllers/draggable-controller';
import { ContextMenuRegistry } from '../services/context-menu-registry';
// Import REAL ContextMenu (no mock)
import { ContextMenu } from '../ui/context-menu';

// Mock dependencies
jest.mock('../code-object-manager');
jest.mock('../selection-manager');
jest.mock('../dependency-manager');
jest.mock('../controllers/draggable-controller');

describe('Context Menu Full Flow', () => {
    let controller: InteractionController;
    let camera: THREE.PerspectiveCamera;
    let domElement: HTMLElement;
    let objects: jest.Mocked<CodeObjectManager>;
    let selectionManager: jest.Mocked<SelectionManager>;
    let vscode: { postMessage: jest.Mock };

    beforeEach(() => {
        // Setup DOM
        domElement = document.createElement('div');
        document.body.appendChild(domElement);

        // Setup Camera
        camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

        // Setup Mocks
        objects = new CodeObjectManager(new THREE.Scene()) as unknown as jest.Mocked<CodeObjectManager>;
        objects.getObjectMeshes = jest.fn().mockReturnValue([]);
        objects.findByMesh = jest.fn();

        selectionManager = new SelectionManager(new THREE.Scene()) as unknown as jest.Mocked<SelectionManager>;

        vscode = { postMessage: jest.fn() };

        // Instantiate Controller - this will create a REAL ContextMenu instance internally
        controller = new InteractionController(
            camera,
            domElement,
            objects,
            selectionManager,
            {} as unknown as import('../dependency-manager').DependencyManager,
            vscode,
            {} as unknown as import('../objects/visual-object').VisualObject & { placingSign: boolean } // character
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
        // Clear global registry providers
        (ContextMenuRegistry.getInstance() as unknown as { providers: unknown[] }).providers = [];
    });

    test('should create DOM elements when right-clicking an object', () => {
        // 1. Arrange: Setup object and raycaster hit
        const objectMesh = new THREE.Mesh();
        const testObj = { id: 'test-obj', type: 'file', filePath: 'test.ts' };

        objects.getObjectMeshes.mockReturnValue([objectMesh]);
        objects.findByMesh.mockReturnValue(testObj as unknown as import('../objects/file-object').FileObject);

        // Setup Raycaster to hit the object
        const raycasterInstance = (THREE.Raycaster as unknown as jest.Mock).mock.results[0].value;
        raycasterInstance.intersectObjects.mockReturnValue([{ object: objectMesh }]);

        // 2. Arrange: Register a provider
        const actionSpy = jest.fn();
        ContextMenuRegistry.getInstance().registerProvider(
            () => true,
            () => [{ id: 'menu-item-1', label: 'Test Action', action: actionSpy }]
        );

        // 3. Act: Trigger Context Menu Event
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100
        });

        // Improve mock for dimensions
        Object.defineProperty(domElement, 'getBoundingClientRect', {
            value: () => ({ left: 0, top: 0, width: 1000, height: 1000 })
        });

        // Trigger logic
        (controller as unknown as { onContextMenu(e: MouseEvent): void }).onContextMenu(event);

        // 4. Assert: Check DOM for menu container
        // Since we are using a manual DOM mock, we check document.body.children
        const bodyChildren = (document.body as unknown as { children: Array<{ className: string, style: Record<string, string>, children: Array<{ className: string, textContent: string, onclick(e: object): void }> }> }).children;
        const menuContainer = bodyChildren.find(el => el.className === 'context-menu-container');

        expect(menuContainer).toBeDefined();
        if (!menuContainer) return;

        // Check styles
        expect(menuContainer.style.position).toBe('fixed');
        expect(menuContainer.style.left).toBe('100px');
        expect(menuContainer.style.top).toBe('100px');

        // Check Items
        expect(menuContainer.children.length).toBe(1);
        const item = menuContainer.children[0];
        expect(item.className).toBe('context-menu-item');
        expect(item.textContent).toBe('Test Action');

        // 5. Act: Click the item
        item.onclick({ stopPropagation: jest.fn() });

        // 6. Assert: Action fired and menu closed
        expect(actionSpy).toHaveBeenCalledWith(testObj);

        // Menu should be removed from body
        const menuAfterClick = (document.body as unknown as { children: Array<{ className: string }> }).children.find(el => el.className === 'context-menu-container');
        expect(menuAfterClick).toBeUndefined();
    });
});
