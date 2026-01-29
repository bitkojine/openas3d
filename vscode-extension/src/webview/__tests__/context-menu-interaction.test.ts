

// Mock document for JSDOM-like behavior in node environment
const createMockElement = (tag: string): any => {
    const el: any = {
        tagName: tag.toUpperCase(),
        style: {} as any,
        classList: { add: jest.fn(), remove: jest.fn(), toggle: jest.fn() },
        children: [] as any[],
        appendChild: jest.fn((child: any) => { return child; }),
        remove: jest.fn(),
        getBoundingClientRect: jest.fn(() => ({ top: 0, left: 0, width: 0, height: 0, right: 0, bottom: 0 })),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
        requestPointerLock: jest.fn(),
    };
    return el;
};

(global as any).document = {
    createElement: jest.fn((tag: string) => createMockElement(tag)),
    body: createMockElement('body'),
    pointerLockElement: null,
    exitPointerLock: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
};

(global as any).MouseEvent = class MouseEvent {
    preventDefault = jest.fn();
    constructor(type: string, props: any) {
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
        Plane: jest.fn(), // If needed by DraggableObjectController mock? No, that's mocked.
    };
});

import * as THREE from 'three';
import { InteractionController } from '../interaction-controller';
import { CodeObjectManager } from '../code-object-manager';
import { SelectionManager } from '../selection-manager';
import { DraggableObjectController } from '../controllers/draggable-controller';
import { ContextMenuRegistry } from '../services/context-menu-registry';

// Mock dependencies
jest.mock('../code-object-manager');
jest.mock('../selection-manager');
jest.mock('../dependency-manager');
jest.mock('../controllers/draggable-controller');
jest.mock('../ui/context-menu');

describe('InteractionController Context Menu', () => {
    let controller: InteractionController;
    let camera: THREE.PerspectiveCamera;
    let domElement: HTMLElement;
    let objects: jest.Mocked<CodeObjectManager>;
    let selectionManager: jest.Mocked<SelectionManager>;
    let draggable: jest.Mocked<DraggableObjectController>;
    let vscode: any;

    beforeEach(() => {
        // Setup DOM
        domElement = document.createElement('div');
        // @ts-ignore
        document.body.appendChild(domElement);

        // Setup Camera
        camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);

        // Setup Mocks
        objects = new CodeObjectManager(new THREE.Scene()) as any;
        objects.getObjectMeshes = jest.fn().mockReturnValue([]);
        objects.findByMesh = jest.fn();

        selectionManager = new SelectionManager(new THREE.Scene()) as any;

        vscode = { postMessage: jest.fn() };

        // Instantiate Controller
        controller = new InteractionController(
            camera,
            domElement,
            objects,
            selectionManager,
            {} as any, // dependencyManager
            vscode,
            {} as any // character
        );
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should raycast from mouse position when unlocked', () => {
        // Arrange
        const objectMesh = new THREE.Mesh(
            new THREE.BoxGeometry(1, 1, 1),
            new THREE.MeshBasicMaterial()
        );
        // Position object at top-left of screen space roughly
        // (We won't actually do full projection math, we just want to verify setFromCamera inputs)

        objects.getObjectMeshes.mockReturnValue([objectMesh]);
        objects.findByMesh.mockReturnValue({ id: 'test-obj' } as any);

        // Get the raycaster instance created by the controller
        // Use results because we explicitly returned a mock object
        const raycasterInstance = (THREE.Raycaster as unknown as jest.Mock).mock.results[0].value;
        const setFromCameraSpy = raycasterInstance.setFromCamera; // Update spy logic handled in previous step

        // Register a dummy provider to ensure logic proceeds
        ContextMenuRegistry.getInstance().registerProvider(
            () => true,
            () => [{ id: 'test', label: 'Test', action: jest.fn() }]
        );

        // Act
        // Simulate event at 100, 100 on a 1000x1000 screen
        const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 100,
            clientY: 100
        });

        // Improve mock for dom element dimensions
        Object.defineProperty(domElement, 'clientWidth', { value: 1000 });
        Object.defineProperty(domElement, 'clientHeight', { value: 1000 });
        Object.defineProperty(domElement, 'getBoundingClientRect', {
            value: () => ({ left: 0, top: 0, width: 1000, height: 1000 })
        });

        // domElement.dispatchEvent(event); 
        // Since addEventListener is mocked and does nothing, we call the handler directly
        (controller as any).onContextMenu(event);

        // Assert
        // If logic is buggy, it sets mouse to (0,0) -> Center
        // If logic is correct, it should calc NDC from 100,100 -> (-0.8, 0.8) approx

        const lastCall = setFromCameraSpy.mock.lastCall;
        const coords = lastCall![0] as THREE.Vector2;

        // This is the bug: it sets it to 0,0 currently
        // We EXPECT it to NOT be 0,0 if we want it to work with mouse clicks
        // But for this reproduction test, let's just log what we got or assert the expected breakdown

        // Debug: Raycast coordinates for testing
        // Current buggy code sets coords to 0,0, expected -0.8, 0.8

        // With current buggy code, this will be 0,0
        // We WANT it to utilize clientX/Y

        // Normalized Device Coordinates (NDC):
        // x = (100 / 1000) * 2 - 1 = -0.8
        // y = -(100 / 1000) * 2 + 1 = 0.8

        // The test: Assert that it is roughly -0.8, 0.8
        expect(coords.x).toBeCloseTo(-0.8);
        expect(coords.y).toBeCloseTo(0.8);
    });
});
