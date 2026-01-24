# Spec: TDD Center

**Status**: Draft
**Owner**: Antigravity
**Date**: 2026-01-24

## 1. Overview
The "TDD Center" is a specialized environment within the OpenAs3D world designed to facilitate Test Driven Development. It allows developers to spatially organize their test files, run them directly from the 3D interface, and receive immediate visual feedback on their code's health.

## 2. Core Features

### 2.1 Free-Form Test Object Placement
**Problem**: The current layout Engine enforces a strict grid/spiral structure organized by architectural zones.
**Solution**:
- Introduce a **Manual Layout Mode** specifically for the "TDD Center" (and potentially global).
- **User Action**: Users can drag and drop "Test Code Objects" to any location.
- **Persistence**: Custom positions are saved in the workspace state (or `.openas3d/layout.json`).
- **Interaction**:
    - "Unlock" an object to detach it from the procedural grid.
    - Drag to move (Raycast against ground plane).
    - "Lock" to save position.

### 2.2 Test Center 2D UI
**Location**: A semi-transparent overlay panel in the Webview (similar to Stats Panel).
**Components**:
- **Business Rules Dictionary** (Test List):
    - Treats Test Names as the "living documentation" of the system.
    - **Indexing**: Organized by Test Suite -> Test Index.
    - **Sort**: A-to-Z.
    - **Display**: Shows the test name as a readable sentence (e.g., "should validate user email" -> "Validate User Email").
- **Controls**:
    - [Run All]
    - [Run Failed]
    - [Toggle Watch Mode] (Icon: Eye)
    - [Health Check] (Run quick smoke tests)
- **Detail View**: When a test object is selected, show its specific output/error logs in the 2D panel.

### 2.3 Visual Feedback System
**Goal**: Immediate "Red/Green" feedback loop in the 3D world.
**Mechanics**:
- **Passing**:
    - Object emits a soft green pulse or glow.
    - Status icon: Green Checkmark floating above the object.
- **Failing**:
    - Object turns Red (or has red tint).
    - Status icon: Red "X" or "!" symbol floating above.
    - **Failure Cone**: A red spotlight beaming down on the failing test object (hard to miss).
- **Running**:
    - Object pulsates yellow/blue or has a "Spinning" status icon.

### 2.4 Test Interaction
- **Edit**: Double-click passes through to VSCode (existing feature).
- **Run Single**: Right-click context menu on a 3D object to "Run This Test".

## 3. Architecture Changes

### 3.1 Extension Host (Backend)
- **`TestDiscoveryService`**:
    - Interacts with VSCode `TestController` API to discover tests.
    - Listens for test results.
- **`LayoutPersistenceManager`**:
    - Stores/Retrieves overrides for object positions: `Map<FileId, Vector3>`.
- **`MessageProtocol` Extensions**:
    - `TEST_RUN_REQUEST` (Webview -> Ext)
    - `TEST_RESULTS_UPDATE` (Ext -> Webview)

### 3.2 Webview (Frontend)
- **`TestManager`**:
    - Manages state of test runs (which objects are failing).
- **`TestVisualizer`**:
    - Decorator for `CodeObject`.
    - Handles status icons (Sprites/Billboards) and Color updates.
- **`DraggableObjectController`**:
    - Handles raycasting logic for dragging objects on the X/Z plane.

## 4. "Other Features" for Software Engineers

### 4.1 "Coverage Heatmap" Mode
- **Feature**: Toggle a "Coverage" view.
- **Visual**:
    - Code Objects (Source files) are colored based on coverage % (Red=0%, Green=100%).
    - Uncovered lines appear as "dark blocks" on the object texture.

### 4.2 "Teleport to Test" / "Teleport to Subject"
- **Feature**:
    - Selecting a Source File shows a 3D line connecting it to its Test File.
    - Context Menu: "Jump to Test" teleports user code to the test location.

### 4.3 "Gamified" Testing (Optional Fun)
- **Feature**:
    - Breaking a build causes a "glitch" effect on the world.
    - Fixing a test triggers a satisfying "Level Up" particle effect.

## 5. Implementation Roadmap

1.  **Phase 1: Foundation**
    - Implement `LayoutPersistence` to allow manual positioning.
    - Create `TestObject` distinct visual (if different from generic FileObject).

2.  **Phase 2: Runner Integration**
    - Connect to VSCode Test API.
    - Build "Test Dashboard" 2D UI.

3.  **Phase 3: Visualization**
    - Implement Red/Green states and Failure Symbols.
    - Add "Watch Mode" toggle logic.
