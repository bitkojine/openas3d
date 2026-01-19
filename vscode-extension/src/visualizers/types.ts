/**
 * Shared types for the visualizers module
 */

/**
 * Represents a code file analyzed from the workspace
 */
export interface CodeFile {
    id: string;
    filePath: string;
    relativePath: string;
    language: string;
    size: number;
    lines: number;
    dependencies: string[];
    complexity?: number;
    lastModified: Date;
    /** Truncated content for textures */
    content: string;
}

/**
 * Represents a dependency relationship between two files
 */
export interface DependencyEdge {
    source: string;
    target: string;
    type: 'import' | 'extends' | 'calls';
}

/**
 * Container for the complete dependency graph
 */
export interface DependencyGraph {
    files: Map<string, CodeFile>;
    edges: DependencyEdge[];
}
