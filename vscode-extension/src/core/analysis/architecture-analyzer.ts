/**
 * Architecture Analyzer
 * 
 * Detects architectural violations in the codebase using dependency-cruiser:
 * - Layer violations (dependencies that break architectural layering)
 * - Circular dependencies
 * - Entry point bloat
 * - Orphan files
 */

// Use strict dynamic import for ESM module
// Do not import values at top level
import type { ICruiseResult, IModule } from 'dependency-cruiser';
import * as path from 'path';
import { ArchitectureWarning, WarningSeverity, WarningType, FileWithZone, ArchitectureDependency } from './types';

export { ArchitectureWarning, WarningSeverity, WarningType, FileWithZone, ArchitectureDependency };

/**
 * Analyze architecture using dependency-cruiser and return warnings
 */
export async function analyzeArchitecture(
    rootPath: string,
    fileIdMap: Map<string, string>, // Map absolute path -> file ID,
    options: { cruiseOptions?: any, tsConfigPath?: string, cruiseFn?: any } = {}
): Promise<ArchitectureWarning[]> {
    const warnings: ArchitectureWarning[] = [];

    try {
        let cruiseOptions = options.cruiseOptions;

        if (!cruiseOptions) {
            // Debug: log the rootPath we're searching from
            console.log('[Architecture] Searching for config, rootPath:', rootPath);

            // Try to find .dependency-cruiser.cjs by walking up from rootPath
            let configPath: string | null = null;
            let searchDir = rootPath;
            const fs = require('fs');

            for (let i = 0; i < 5; i++) { // Search up to 5 levels
                const candidate = path.join(searchDir, '.dependency-cruiser.cjs');
                console.log('[Architecture] Checking:', candidate);
                if (fs.existsSync(candidate)) {
                    configPath = candidate;
                    break;
                }
                searchDir = path.dirname(searchDir);
            }

            if (configPath) {
                try {
                    // Use native Node.js require to bypass Webpack's bundled require
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const Module = require('module');
                    const nativeRequire = Module.createRequire(__filename);
                    const config = nativeRequire(configPath);
                    // Merge options and forbidden rules into cruiseOptions
                    cruiseOptions = {
                        ...(config.options || {}),
                        ruleSet: {
                            forbidden: config.forbidden || []
                        }
                    };
                    console.log('[Architecture] Loaded config from:', configPath);
                } catch (e) {
                    console.warn('[Architecture] Could not load .dependency-cruiser.cjs:', e);
                    cruiseOptions = {};
                }
            } else {
                console.warn('[Architecture] No .dependency-cruiser.cjs found, using default options');
                cruiseOptions = {};
            }
        }

        // Use injected cruise function for testing, or dynamically import for production
        let cruise = options.cruiseFn;
        if (!cruise) {
            // Dynamically import dependency-cruiser to avoid ESM/CJS issues at startup
            // Use new Function to prevent Webpack from converting to require()
            // eslint-disable-next-line @typescript-eslint/naming-convention
            const mod = await (new Function('return import("dependency-cruiser")'))();
            cruise = mod.cruise;
        }

        // Find tsconfig.json - search in rootPath and subdirectories
        let tsConfigPath = options.tsConfigPath;
        let scanPath = rootPath; // Default to rootPath

        if (!tsConfigPath) {
            const fs = require('fs');
            // Check in common locations - prefer locations with both tsconfig and src
            const candidates = [
                { tsconfig: path.join(rootPath, 'tsconfig.json'), src: path.join(rootPath, 'src') },
                { tsconfig: path.join(rootPath, 'vscode-extension', 'tsconfig.json'), src: path.join(rootPath, 'vscode-extension', 'src') },
                { tsconfig: path.join(rootPath, 'src', 'tsconfig.json'), src: path.join(rootPath, 'src') }
            ];
            for (const candidate of candidates) {
                if (fs.existsSync(candidate.tsconfig) && fs.existsSync(candidate.src)) {
                    tsConfigPath = candidate.tsconfig;
                    scanPath = candidate.src;
                    console.log('[Architecture] Found tsconfig at:', tsConfigPath);
                    console.log('[Architecture] Scanning src at:', scanPath);
                    break;
                }
            }
        }

        const effectiveBaseDir = tsConfigPath ? path.dirname(tsConfigPath) : rootPath;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = await cruise(
            [path.relative(effectiveBaseDir, scanPath)], // Pass relative path to baseDir
            {
                ...cruiseOptions,
                baseDir: effectiveBaseDir
            },
            undefined,
            tsConfigPath ? { tsConfig: { fileName: tsConfigPath } } : undefined
        );

        if (result.outputType === 'err') {
            console.error('Dependency-cruiser failed:', result);
            return [];
        }

        // Process violations from dependency-cruiser
        // dependency-cruiser reports violations on modules (files)

        // 1. Map Modules to our File IDs
        const moduleByPath = new Map<string, IModule>();

        if (result.output?.modules) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const mod of result.output.modules as any[]) {
                const absPath = path.isAbsolute(mod.source)
                    ? mod.source
                    : path.resolve(effectiveBaseDir, mod.source);

                moduleByPath.set(absPath, mod);
            }
        }

        // 2. Process Forbidden Rules (Cycles, Layer Violations, Orphans)
        // cruise() API returns { output: { modules, summary } } not { modules, summary }
        const summary = result.output?.summary || result.summary;
        const violations = summary?.violations || [];
        console.log('[Architecture] Summary keys:', summary ? Object.keys(summary) : 'N/A');
        console.log('[Architecture] RuleSetUsed forbidden count:', summary?.ruleSetUsed?.forbidden?.length || 0);
        console.log('[Architecture] Total files cruised:', summary?.totalCruised || 0);
        console.log('[Architecture] Violations from dep-cruiser:', violations.length);
        if (violations.length > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const violation of violations as any[]) {
                const sourceAbsPath = path.isAbsolute(violation.from)
                    ? violation.from
                    : path.resolve(effectiveBaseDir, violation.from);

                const sourceId = fileIdMap.get(sourceAbsPath);

                if (!sourceId) continue; // Skip if we don't track this file

                const relatedIds: string[] = [];
                if (violation.to) {
                    const targetAbsPath = path.isAbsolute(violation.to)
                        ? violation.to
                        : path.resolve(effectiveBaseDir, violation.to);
                    const targetId = fileIdMap.get(targetAbsPath);
                    if (targetId) relatedIds.push(targetId);
                }

                if (violation.cycle) {
                    // For cycles, add all participants as related
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    for (const step of violation.cycle) {
                        const stepSource = typeof step === 'string' ? step : step.name || step.source;

                        const stepAbsPath = path.isAbsolute(stepSource)
                            ? stepSource
                            : path.resolve(effectiveBaseDir, stepSource);
                        const stepId = fileIdMap.get(stepAbsPath);
                        if (stepId && stepId !== sourceId && !relatedIds.includes(stepId)) {
                            relatedIds.push(stepId);
                        }
                    }
                }

                let type: WarningType = 'unknown';
                let severity: WarningSeverity = 'medium';

                if (violation.rule.name === 'no-circular') {
                    type = 'circular-dependency';
                    severity = 'high';
                } else if (violation.rule.name === 'no-orphans') {
                    type = 'orphan';
                    severity = 'low';
                } else if (violation.rule.name.startsWith('layer-')) {
                    type = 'layer-violation';
                    severity = 'high';
                }

                warnings.push({
                    fileId: sourceId,
                    type,
                    message: violation.rule.name + ': ' + (violation.comment || 'Violation detected'),
                    severity,
                    relatedFileIds: relatedIds
                });
            }
        }

        // 3. Custom Checks (Entry Bloat) - Dependency-cruiser counts dependencies too
        // We can iterate over modules to check for bloated entry points
        const ENTRY_BLOAT_THRESHOLD = 15;
        if (result.modules) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            for (const mod of result.modules as any[]) {
                const absPath = path.resolve(rootPath, mod.source);
                const id = fileIdMap.get(absPath);
                if (!id) continue;

                // Check if it's an entry point (simple heuristic or use our zone map if we had it)
                // For now, let's look at dependencies count
                if (mod.dependencies.length > ENTRY_BLOAT_THRESHOLD) {
                    // Check if it looks like an entry point
                    if (mod.source.includes('index') || mod.source.includes('main') || mod.source.includes('App')) {
                        warnings.push({
                            fileId: id,
                            type: 'entry-bloat',
                            message: `Entry point has ${mod.dependencies.length} dependencies (consider splitting)`,
                            severity: 'low'
                        });
                    }
                }
            }
        }

    } catch (error) {
        console.error('Architecture analysis error:', error);
    }

    return warnings;
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
