/**
 * Core domain types - pure TypeScript, no framework dependencies.
 * These types represent the fundamental entities of the codebase analysis domain.
 */

import { ImportKind } from './code-entity';

// Re-export for backward compatibility
export { ImportKind };

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
    /** Number of imports from source to target (for line thickness) */
    weight?: number;
    /** True if this is part of a circular dependency */
    isCircular?: boolean;
    /** Kind of import for visual styling */
    importKind?: ImportKind;
}

/**
 * Container for the complete dependency graph
 */
export interface DependencyGraph {
    files: Map<string, CodeFile>;
    edges: DependencyEdge[];
}

