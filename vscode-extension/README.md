# OpenAs3D VSCode Extension

Visualize codebase dependencies and architecture in navigable 3D worlds.

## Features

- **3D Codebase Visualization**: Transform your code structure into an interactive 3D world
- **Dependency Analysis**: See import relationships and module dependencies as spatial connections
- **Code Metrics Integration**: Visualize complexity, file size, and code quality metrics
- **Interactive Navigation**: Walk through your codebase using WASD controls and mouse look
- **Multi-Language Support**: Works with TypeScript, JavaScript, Python, Java, Go, and more
- **Real-time Updates**: See changes reflected in the 3D world as you modify code

## Installation

1. Install from the VSCode marketplace (coming soon)
2. Or install from VSIX file:
   - Download the latest `.vsix` file from releases
   - Run `code --install-extension openas3d-vscode-x.x.x.vsix`

## Usage

### Getting Started

1. Open a workspace/folder in VSCode
2. Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)
3. Run "OpenAs3D: Explore Dependencies in 3D"
4. Navigate the 3D world using WASD keys and mouse

### Controls

- **WASD** - Move camera forward/backward/left/right
- **Mouse** - Look around (click to lock mouse)
- **F** - Toggle flight mode (allows vertical movement)
- **Space/C** - Move up/down (flight mode only)
- **ESC** - Release mouse lock
- **Click** - Select object and view details
- **Double-click** - Open corresponding file in editor

### Context Menu

Right-click on any folder in the VSCode Explorer and select "Explore Dependencies in 3D" to visualize that specific directory.

## Visualization

### Object Representation

- **Files/Modules**: Represented as 3D boxes
- **Color**: Indicates programming language
- **Height**: Represents code complexity
- **Width**: Represents file size
- **Position**: Clustered by architectural relationships

### Language Colors

- TypeScript: Blue (#3178C6)
- JavaScript: Yellow (#F7DF1E)
- Python: Blue (#3776AB)
- Java: Orange (#ED8B00)
- Go: Cyan (#00ADD8)
- C#: Green (#239120)
- C/C++: Dark Blue (#00599C)

### Metrics Integration

The extension analyzes your code to extract:
- Import/export relationships
- Cyclomatic complexity
- File sizes and line counts
- Code churn (modification frequency)
- Architectural patterns

## Requirements

- VSCode 1.74.0 or higher
- WebGL-capable browser engine (built into VSCode)
- Workspace with source code files

## Extension Settings

This extension contributes the following settings:

- `openas3d.autoAnalyze`: Automatically analyze codebase when workspace opens
- `openas3d.maxFiles`: Maximum number of files to analyze (default: 1000)
- `openas3d.excludePatterns`: File patterns to exclude from analysis

## Known Issues

- Large codebases (>5000 files) may experience performance issues
- Some dependency relationships may not be detected for dynamic imports
- Real-time updates are not yet implemented for all file changes

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/openas3d/vscode-extension.git
cd vscode-extension

# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Run in development mode
npm run watch
```

### Testing

```bash
# Run unit tests
npm test

# Package extension
npm run package
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- [GitHub Issues](https://github.com/openas3d/vscode-extension/issues)
- [Documentation](https://openas3d.dev/docs)
- [Discord Community](https://discord.gg/openas3d)

## Roadmap

- [ ] Real-time code change visualization
- [ ] Collaborative exploration features
- [ ] Additional language support
- [ ] Performance optimizations for large codebases
- [ ] Integration with code quality tools
- [ ] Export and sharing capabilities