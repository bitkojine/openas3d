# OpenAs3D - VSCode Extension

Walk through your codebase in 3D! OpenAs3D is a VSCode extension that transforms your code into a navigable 3D world where you can explore dependencies, complexity, and architecture spatially.

## 🎮 Features

- **3D Code Exploration**: Files become 3D objects you can walk around
- **Character Movement**: WASD + mouse controls like a video game
- **Spatial Understanding**: Height = complexity, Color = language
- **VSCode Integration**: Click objects to open files, seamless workflow
- **Multi-Language**: TypeScript, JavaScript, Python, Java, Go, C#, C++
- **Beautiful World**: Bright daytime planet atmosphere with realistic physics

## 🚀 Quick Start

### Installation
```bash
cd vscode-extension
npm install
npm run compile
```

### Development Testing
1. Open `vscode-extension` folder in VSCode
2. Press **F5** to launch Extension Development Host
3. In new window: Open `demo-project` folder
4. Command Palette: "OpenAs3D: Explore Dependencies in 3D"
5. Walk around with WASD + mouse!

### Controls
- **WASD** - Move character
- **Mouse** - Look around (click to lock)
- **Space** - Jump (or up in flight mode)
- **F** - Toggle flight mode
- **C** - Down (flight mode only)
- **ESC** - Release mouse lock
- **Click objects** - Select and see file info
- **Double-click objects** - Open file in VSCode

## 🌟 The Experience

Instead of scrolling through flat file trees, you **walk through your codebase** like exploring a beautiful planet. Your brain's spatial memory makes it easier to remember "the tall blue tower in the northwest" than "UserService.ts line 47."

Perfect for:
- Understanding unfamiliar codebases
- Onboarding new team members  
- Architecture discussions
- Finding complexity hotspots

## 📁 Project Structure

```
vscode-extension/          # VSCode extension
├── src/
│   ├── extension.ts       # Extension entry point
│   ├── webview/           # 3D world rendering
│   └── visualizers/       # Code analysis
├── demo-project/          # Test TypeScript project
└── package.json           # Extension manifest

.kiro/specs/              # Feature specifications
```

## 🎯 What's Visualized

- **Files as 3D objects** with height showing complexity
- **Language colors** (TypeScript=blue, JavaScript=yellow, etc.)
- **Spatial clustering** based on dependencies
- **Beautiful daytime world** with grass, sky, and atmosphere
- **Realistic physics** with jumping and flight modes

## 🔧 Development

```bash
# Compile extension
npm run compile

# Package for distribution  
npm run package

# Watch mode for development
npm run watch
```

## 🚀 Ready to Ship

This extension is production-ready and can be:
- Installed from .vsix package
- Published to VSCode marketplace
- Shared with developers immediately
- Used for demos and presentations

**Experience your code like never before!** 🌟
