/**
 * Unified language registry - single source of truth for language mappings.
 * Consolidates duplicated logic from codebase.ts, code-object-manager.ts, 
 * panel.ts, and file-system.ts.
 */

export interface LanguageDefinition {
    /** Display name for the language */
    name: string;
    /** File extensions that map to this language (including the dot) */
    extensions: string[];
    /** Hex color for 3D visualization */
    color: number;
    /** Whether this language supports dependency extraction */
    supportsCodeAnalysis: boolean;
}

/**
 * Canonical registry of all supported languages.
 */
export const LANGUAGE_REGISTRY: Record<string, LanguageDefinition> = {
    typescript: {
        name: 'TypeScript',
        extensions: ['.ts', '.tsx'],
        color: 0x3178C6,
        supportsCodeAnalysis: true
    },
    javascript: {
        name: 'JavaScript',
        extensions: ['.js', '.jsx'],
        color: 0xF7DF1E,
        supportsCodeAnalysis: true
    },
    python: {
        name: 'Python',
        extensions: ['.py'],
        color: 0x3776AB,
        supportsCodeAnalysis: true
    },
    java: {
        name: 'Java',
        extensions: ['.java'],
        color: 0xED8B00,
        supportsCodeAnalysis: true
    },
    go: {
        name: 'Go',
        extensions: ['.go'],
        color: 0x00ADD8,
        supportsCodeAnalysis: true
    },
    csharp: {
        name: 'C#',
        extensions: ['.cs'],
        color: 0x239120,
        supportsCodeAnalysis: true
    },
    cpp: {
        name: 'C++',
        extensions: ['.cpp', '.hpp', '.cc', '.cxx'],
        color: 0x00599C,
        supportsCodeAnalysis: true
    },
    c: {
        name: 'C',
        extensions: ['.c', '.h'],
        color: 0x555555,
        supportsCodeAnalysis: true
    },
    rust: {
        name: 'Rust',
        extensions: ['.rs'],
        color: 0xDEA584,
        supportsCodeAnalysis: false
    },
    ruby: {
        name: 'Ruby',
        extensions: ['.rb'],
        color: 0xCC342D,
        supportsCodeAnalysis: false
    },
    php: {
        name: 'PHP',
        extensions: ['.php'],
        color: 0x777BB4,
        supportsCodeAnalysis: false
    },
    swift: {
        name: 'Swift',
        extensions: ['.swift'],
        color: 0xF05138,
        supportsCodeAnalysis: false
    },
    kotlin: {
        name: 'Kotlin',
        extensions: ['.kt', '.kts'],
        color: 0x7F52FF,
        supportsCodeAnalysis: false
    },
    scala: {
        name: 'Scala',
        extensions: ['.scala'],
        color: 0xDC322F,
        supportsCodeAnalysis: false
    },
    markdown: {
        name: 'Markdown',
        extensions: ['.md'],
        color: 0xFFD700,
        supportsCodeAnalysis: false
    },
    json: {
        name: 'JSON',
        extensions: ['.json'],
        color: 0xFF8C00,
        supportsCodeAnalysis: false
    },
    yaml: {
        name: 'YAML',
        extensions: ['.yml', '.yaml'],
        color: 0x20B2AA,
        supportsCodeAnalysis: false
    },
    toml: {
        name: 'TOML',
        extensions: ['.toml'],
        color: 0x8A2BE2,
        supportsCodeAnalysis: false
    }
};

/** Default color for unknown languages */
const DEFAULT_COLOR = 0xAAAAAA;

/** Build a reverse lookup map on first use */
let extensionToLanguageMap: Map<string, string> | null = null;

function getExtensionMap(): Map<string, string> {
    if (!extensionToLanguageMap) {
        extensionToLanguageMap = new Map();
        for (const [langId, def] of Object.entries(LANGUAGE_REGISTRY)) {
            for (const ext of def.extensions) {
                extensionToLanguageMap.set(ext.toLowerCase(), langId);
            }
        }
    }
    return extensionToLanguageMap;
}

/**
 * Get language identifier from file extension.
 * @param ext File extension including dot (e.g., '.ts')
 * @returns Language identifier (e.g., 'typescript') or 'other' if unknown
 */
export function getLanguageFromExtension(ext: string): string {
    const map = getExtensionMap();
    return map.get(ext.toLowerCase()) || 'other';
}

/**
 * Get the hex color for a language's 3D visualization.
 * @param language Language identifier (e.g., 'typescript')
 * @returns Hex color value
 */
export function getLanguageColor(language: string): number {
    const langLower = language.toLowerCase();
    return LANGUAGE_REGISTRY[langLower]?.color ?? DEFAULT_COLOR;
}

/**
 * Check if a language supports code analysis (dependency extraction).
 * @param language Language identifier
 * @returns true if the language can have its dependencies analyzed
 */
export function isCodeLanguage(language: string): boolean {
    const langLower = language.toLowerCase();
    return LANGUAGE_REGISTRY[langLower]?.supportsCodeAnalysis ?? false;
}

/**
 * Get display name for a language.
 * @param language Language identifier
 * @returns Human-readable language name
 */
export function getLanguageDisplayName(language: string): string {
    const langLower = language.toLowerCase();
    return LANGUAGE_REGISTRY[langLower]?.name ?? 'Unknown';
}

/**
 * Get all extensions that map to code languages (for filtering).
 */
export function getCodeLanguageExtensions(): string[] {
    const exts: string[] = [];
    for (const def of Object.values(LANGUAGE_REGISTRY)) {
        if (def.supportsCodeAnalysis) {
            exts.push(...def.extensions);
        }
    }
    return exts;
}
