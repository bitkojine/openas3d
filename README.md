## Getting started

1. Open any folder that contains source files you want to explore in 3D.

2. Build and install the VSCode extension:

```zsh
cd vscode-extension
```

```zsh
npm install
```

```zsh
npm run build-install-test
```

3. If VSCode prompts you in the Extensions sidebar, restart extensions using the UI button.

4. Start **OpenAs3D** using the VSCode Command Palette and running:

```
>Openas3D: Open as 3D World
```

The current workspace will be opened as a navigable 3D world.

## About OpenAs3D

This is an experiment in transforming real software systems into explorable 3D spaces.

The core idea: complex systems are often easier to understand as places rather than lists, trees, or diagrams. OpenAs3D investigates what happens when a codebase is treated as a navigable environment instead of a static set of files.

This repository contains the source for a Visual Studio Code extension that renders your codebase as a 3D world. Files become spatial objects you can inspect and reason about using video game–like navigation. Worlds can be loaded per workspace, and multiple worlds can coexist, allowing you to explore different parts of a system simultaneously.

OpenAs3D is not a game—it’s a developer tool and cognitive interface. Its goal is insight, orientation, and faster comprehension of structures and relationships that are difficult to grasp in text alone.

### Guiding principles:

- Systems are places, not diagrams.

- Exploration precedes explanation.

- Spatial memory reduces cognitive load.

- Worlds are integrated into your IDE workflow.

OpenAs3D is a greenfield exploration of a “spatial IDE”—built on real developer workflows rather than replacing them. The experience may feel unexpected at first, but it quickly becomes intuitive and revealing.
