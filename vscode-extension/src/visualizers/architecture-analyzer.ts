/**
 * Architecture Analyzer
 * 
 * Detects architectural violations in the codebase:
 * - Layer violations (dependencies that break architectural layering)
 * - Circular dependencies
 * - Entry point bloat
 */

export type WarningSeverity = 'high' | 'medium' | 'low';
export type WarningType = 'layer-violation' | 'circular-dependency' | 'entry-bloat' | 'orphan';

export interface ArchitectureWarning {
    fileId: string;
    type: WarningType;
    message: string;
    severity: WarningSeverity;
    relatedFileIds?: string[];
}

export interface FileWithZone {
    id: string;
    filePath: string;
    zone: string;
}

export interface Dependency {
    sourceId: string;
    targetId: string;
}

/**
 * Defines allowed dependency directions between zones.
 * Key = source zone, Value = array of allowed target zones.
 * 
 * Architectural layers (top to bottom):
 *   entry → api → core → data
 *               ↘   ↓   ↙
 *                  lib
 *   ui → core, lib
 *   infra, test → (any)
 */
const ALLOWED_DEPENDENCIES: Record<string, string[]> = {
    entry: ['api', 'core', 'data', 'lib', 'ui'],  // Entry can use anything
    api: ['core', 'data', 'lib'],               // API layer
    core: ['data', 'lib'],                       // Core logic
    data: ['lib'],                               // Data layer - lowest
    ui: ['core', 'data', 'lib'],               // UI can use core/data
    lib: [],                                    // Lib should be standalone
    infra: ['entry', 'api', 'core', 'data', 'lib', 'ui', 'infra', 'test'], // Infra can use anything
    test: ['entry', 'api', 'core', 'data', 'lib', 'ui', 'infra', 'test'], // Tests can use anything
};

/**
 * Check if a dependency from sourceZone to targetZone is allowed
 */
function isDependencyAllowed(sourceZone: string, targetZone: string): boolean {
    // Same zone is always allowed
    if (sourceZone === targetZone) return true;

    const allowed = ALLOWED_DEPENDENCIES[sourceZone];
    if (!allowed) return true; // Unknown zone, allow by default

    return allowed.includes(targetZone);
}

/**
 * Analyze architecture and return warnings
 */
export function analyzeArchitecture(
    files: FileWithZone[],
    dependencies: Dependency[]
): ArchitectureWarning[] {
    const warnings: ArchitectureWarning[] = [];

    // Build lookup maps
    const fileById = new Map<string, FileWithZone>();
    files.forEach(f => fileById.set(f.id, f));

    // Count dependencies per file
    const outgoingDeps = new Map<string, string[]>();
    const incomingDeps = new Map<string, string[]>();

    dependencies.forEach(dep => {
        if (!outgoingDeps.has(dep.sourceId)) outgoingDeps.set(dep.sourceId, []);
        if (!incomingDeps.has(dep.targetId)) incomingDeps.set(dep.targetId, []);
        outgoingDeps.get(dep.sourceId)!.push(dep.targetId);
        incomingDeps.get(dep.targetId)!.push(dep.sourceId);
    });

    // 1. Check for layer violations
    dependencies.forEach(dep => {
        const source = fileById.get(dep.sourceId);
        const target = fileById.get(dep.targetId);

        if (!source || !target) return;

        if (!isDependencyAllowed(source.zone, target.zone)) {
            warnings.push({
                fileId: dep.sourceId,
                type: 'layer-violation',
                message: `${source.zone.toUpperCase()} → ${target.zone.toUpperCase()}: "${getBasename(source.filePath)}" imports from "${getBasename(target.filePath)}"`,
                severity: 'high',
                relatedFileIds: [dep.targetId]
            });
        }
    });

    // 2. Check for circular dependencies
    const cycles = findCycles(dependencies);
    cycles.forEach(cycle => {
        const cycleFiles = cycle.map(id => fileById.get(id));
        const cycleNames = cycleFiles.map(f => f ? getBasename(f.filePath) : '?').join(' → ');

        warnings.push({
            fileId: cycle[0],
            type: 'circular-dependency',
            message: `Circular: ${cycleNames} → ${cycleFiles[0] ? getBasename(cycleFiles[0].filePath) : '?'}`,
            severity: 'medium',
            relatedFileIds: cycle.slice(1)
        });
    });

    // 3. Check for entry point bloat
    const ENTRY_BLOAT_THRESHOLD = 15;
    files.forEach(file => {
        if (file.zone === 'entry') {
            const deps = outgoingDeps.get(file.id) || [];
            if (deps.length > ENTRY_BLOAT_THRESHOLD) {
                warnings.push({
                    fileId: file.id,
                    type: 'entry-bloat',
                    message: `Entry point "${getBasename(file.filePath)}" has ${deps.length} dependencies (consider splitting)`,
                    severity: 'low'
                });
            }
        }
    });

    // 4. Check for orphan files (no imports and no exports)
    files.forEach(file => {
        const hasOutgoing = (outgoingDeps.get(file.id) || []).length > 0;
        const hasIncoming = (incomingDeps.get(file.id) || []).length > 0;

        // Skip test files and entry points for orphan detection
        if (file.zone === 'test' || file.zone === 'entry') return;

        if (!hasOutgoing && !hasIncoming) {
            warnings.push({
                fileId: file.id,
                type: 'orphan',
                message: `"${getBasename(file.filePath)}" has no dependencies (might be unused)`,
                severity: 'low'
            });
        }
    });

    return warnings;
}

/**
 * Find all cycles in the dependency graph using DFS
 */
function findCycles(dependencies: Dependency[]): string[][] {
    const graph = new Map<string, string[]>();

    dependencies.forEach(dep => {
        if (!graph.has(dep.sourceId)) graph.set(dep.sourceId, []);
        graph.get(dep.sourceId)!.push(dep.targetId);
    });

    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    function dfs(node: string): void {
        visited.add(node);
        recStack.add(node);
        path.push(node);

        const neighbors = graph.get(node) || [];
        for (const neighbor of neighbors) {
            if (!visited.has(neighbor)) {
                dfs(neighbor);
            } else if (recStack.has(neighbor)) {
                // Found a cycle - extract it
                const cycleStart = path.indexOf(neighbor);
                if (cycleStart !== -1) {
                    const cycle = path.slice(cycleStart);
                    // Only add if we haven't seen this cycle before
                    const cycleKey = [...cycle].sort().join('|');
                    const existingKeys = cycles.map(c => [...c].sort().join('|'));
                    if (!existingKeys.includes(cycleKey)) {
                        cycles.push(cycle);
                    }
                }
            }
        }

        path.pop();
        recStack.delete(node);
    }

    // Run DFS from all nodes
    for (const node of graph.keys()) {
        if (!visited.has(node)) {
            dfs(node);
        }
    }

    return cycles;
}

/**
 * Get basename from file path
 */
function getBasename(filePath: string): string {
    const parts = filePath.split(/[/\\]/);
    return parts[parts.length - 1] || filePath;
}

/**
 * Get warnings grouped by file ID
 */
export function getWarningsByFile(warnings: ArchitectureWarning[]): Map<string, ArchitectureWarning[]> {
    const byFile = new Map<string, ArchitectureWarning[]>();

    warnings.forEach(w => {
        if (!byFile.has(w.fileId)) byFile.set(w.fileId, []);
        byFile.get(w.fileId)!.push(w);
    });

    return byFile;
}

/**
 * Get summary of warnings by severity
 */
export function getWarningSummary(warnings: ArchitectureWarning[]): { high: number; medium: number; low: number } {
    return {
        high: warnings.filter(w => w.severity === 'high').length,
        medium: warnings.filter(w => w.severity === 'medium').length,
        low: warnings.filter(w => w.severity === 'low').length
    };
}
