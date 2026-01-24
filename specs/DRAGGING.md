# Spec: 3D Object Dragging & Layout

**Status**: Draft
**Owner**: Antigravity
**Date**: 2026-01-24

## 1. Vision
A physical, tactile, and precise way to organize the 3D codebase. Dragging should feel like moving "data-bricks" around a playground, with intelligent snapping and visual guides that make the underlying architecture clear.

## 2. Core Mechanics

### 2.1 The "Stether" (Distance-Based Drag)
**Goal**: Solve the "grazing angle" and eye-level navigation issues.
- When an object is grabbed, it is attached to the player's view by a virtual "tether" (Stether).
- It maintains its vertical height (Y-Lock) and its relative distance to the camera.
- **Perfect Feel**: The object follows the crosshair exactly, moving in a circle around the player if they rotate, and keeping its distance if they move forward/backward.

### 2.2 Movement Orchestration
**Problem**: Currently, moving the character while dragging is glitchy or blocked by input conflicts.
- **Solution**: Dragging should NOT disable WASD movement.
- If the player moves forward while dragging, the object should move forward too (maintaining `initialDistance`).
- If the player rotates, the object should swing with the view.

### 2.3 Visual Guides & Interaction
- **Center Ray**: A subtle beam or line connecting the crosshair to the center of the dragged object.
- **Ground Projection**: A soft circle or shadow projected directly beneath the object on the ground to show its exact 2D position.
- **Proximity Highlighting**: Nearby objects pulse slightly to indicate they might be "connected" or "swapped".

## 3. High-Value Features (The "Perfect" Drag)

### 3.1 Snap-to-Grid (Toggleable)
- Hold `Ctrl` or toggle a mode to snap the object to a 1x1 or 5x5 unit grid.
- Visual: A faint grid appears on the grass/pavement when snapping is active.

### 3.2 Intelligent Collision (Non-Overlapping)
- Objects should have "physicality". 
- When dragging an object, it should "push" other objects out of the way or refuse to settle in a spot that is already occupied.
- Use a repulsive force field when objects get within 1.5 units of each other.

### 3.3 Zone Awareness
- Moving an object across a zone boundary (e.g., from `core` to `ui`) should trigger a visual "spark" or effect.
- **Auto-Zone Suggestion**: If an object is dragged into a specific folder's physical area, suggest updating its actual file path (refactoring).

### 3.4 Multi-Object Selection ("Lasso/Marquee Drag")
- Ability to select a group of objects (e.g., a whole directory) and move them as a single block.

## 4. Technical Requirements

### 4.1 Persistence Layer
- Every move must be saved to `.openas3d/layout.json` (Implemented).
- Add **Undo/Redo** support (`Cmd+Z`) for layout changes.

### 4.2 Webview -> Extension Sync
- Use the `MOVE_OBJECT` message to push real-time updates.
- Throttling: Send persistence updates to the extension @ 10Hz, but update the 3D scene @ 60Hz for smoothness.

## 5. Roadmap
1. [ ] **Phase 1: Polish Stether** (Fix character + drag sync).
2. [ ] **Phase 2: Visual Guides** (Center ray + Ground projection).
3. [ ] **Phase 3: Social/Collaboration** (See where others are dragging objects in real-time).
