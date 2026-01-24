# UI Layout & Collapsible Components

## Goal
As the number of diagnostic and control panels in the 3D park grows (TDD Results, Git Blame, AI Chat, etc.), we must avoid cluttering the 3D viewport. This spec defines a standard "Micro-Panel" pattern where UI components can collapse into minimal icon-only buttons.

## Design Pattern: The "Dock"
UI panels should generally reside in corners and support a dual-state:
1.  **Expanded**: Full functional panel with title, controls, and content.
2.  **Minimized**: A small, circular or semi-rounded button with an icon.

### Transitions
-   Smooth CSS transitions for width/height/opacity.
-   Panels should "pop" into buttons and "unfurl" back into panels.

### Positioning
-   **Top-Left**: TDD / Business Rules.
-   **Top-Right**: System Status / AI Feedback.
-   **Bottom-Left**: Navigation / Compass.
-   **Bottom-Right**: Settings / Debug.

## Implementation Standard
All UI components (classes) should implement a common interface or pattern:
-   `toggleCollapse()`: Switches between states.
-   `state`: 'expanded' | 'collapsed'.
-   CSS-based layout toggling using classes like `.ui-collapsed`.

## Layout Rules
-   Minimized buttons should be anchored to the same corner as their expanded form.
-   Buttons should have the same translucent background as the panels for consistency.
-   Hovering over a minimized button should show a tooltip with the panel's name.
