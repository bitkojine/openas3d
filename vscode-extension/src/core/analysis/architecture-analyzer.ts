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
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ArchitectureWarning, WarningSeverity, WarningType, FileWithZone, ArchitectureDependency } from './types';
import { PerfTracker } from '../../utils/perf-tracker';

export { ArchitectureWarning, WarningSeverity, WarningType, FileWithZone, ArchitectureDependency };

/**
 * Analyze architecture using dependency-cruiser and return warnings
 */
export async function analyzeArchitecture(
    rootPath: string,
    fileIdMap: Map<string, string>, // Map absolute path -> file ID,
    options: { cruiseOptions?: any, tsConfigPath?: string, cruiseFn?: any, extensionPath?: string } = {}
): Promise<ArchitectureWarning[]> {
    const perfLabel = 'ArchitectureAnalyzer.analyzeArchitecture';
    const perfStart = PerfTracker.instance?.start(perfLabel);

    try {
        const warnings: ArchitectureWarning[] = [];

        // 1. Locate Configuration Files
        let configPath: string | null = null;
        let searchDir = rootPath;

        for (let i = 0; i < 5; i++) { // Search up to 5 levels
            const candidate = path.join(searchDir, '.dependency-cruiser.cjs');
            if (fs.existsSync(candidate)) {
                configPath = candidate;
                break;
            }
            searchDir = path.dirname(searchDir);
        }

        if (configPath) {
            // config found
        } else {
            console.warn('[Architecture] No .dependency-cruiser.cjs found');
        }

        // Find tsconfig.json
        let tsConfigPath = options.tsConfigPath;
        let scanPath = rootPath; // Default to rootPath

        if (!tsConfigPath) {
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
                    break;
                }
            }
        }

        const effectiveBaseDir = tsConfigPath ? path.dirname(tsConfigPath) : rootPath;

        // 2. Execute Analysis
        // Use injected cruise function for testing if provided
        let result: any = null;

        if (options.cruiseFn) {
            try {
                // Legacy/Test mode using injected function
                // We need to re-construct options object if we are mocking
                // For now, minimal support or robust support logic? 
                // The tests inject a mock that returns a promise.
                // We'll just call it as before.
                const cruiseOptions = options.cruiseOptions || {}; // We don't load config manually anymore for CLI, but for mock? 
                // Actually, if we use cruiseFn, we might not have loaded config contents since we deleted that code.
                // Tests usually mock the return value regardless of inputs.

                result = await options.cruiseFn(
                    [path.relative(effectiveBaseDir, scanPath)],
                    {
                        ...cruiseOptions,
                        baseDir: effectiveBaseDir
                    },
                    undefined,
                    tsConfigPath ? { tsConfig: { fileName: tsConfigPath } } : undefined
                );
            } catch (e) {
                console.error('[Architecture] Injected cruiseFn failed:', e);
            }
        } else {
            // CLI Spawn Mode
            if (!options.extensionPath) {
                // Fallback for dev/test without extensionPath? 
                // Logic: failed if we can't find binary.
                console.error('[Architecture] extensionPath not provided, cannot find dependency-cruiser CLI');
                return [];
            }

            const cliPath = path.join(options.extensionPath, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruise.mjs');
            if (!fs.existsSync(cliPath)) {
                console.error('[Architecture] dependency-cruiser CLI not found at:', cliPath);
                return [];
            }

            const args = ['--output-type', 'json'];
            if (configPath) {
                args.push('--config', configPath);
            }
            if (tsConfigPath) {
                args.push('--ts-config', tsConfigPath);
            }

            // Target path (relative to CWD or absolute? CLI accepts strict relative if we are careful)
            // Usually assume CWD is rootPath or we set cwd in spawn.
            // Let's set cwd to effectiveBaseDir
            args.push(path.relative(effectiveBaseDir, scanPath));



            try {

                const child = spawn(process.execPath, [cliPath, ...args], {
                    cwd: effectiveBaseDir,
                    env: process.env
                });

                const stdout: Buffer[] = [];
                const stderr: Buffer[] = [];

                await new Promise<void>((resolve, reject) => {
                    child.stdout.on('data', (data: Buffer) => stdout.push(data));
                    child.stderr.on('data', (data: Buffer) => stderr.push(data));
                    child.on('close', (code: number) => {
                        if (code !== 0 && code !== 0) { // dep-cruiser might return non-zero on violations, which is fine
                            // We check output validity instead of exit code strictly
                        }
                        resolve();
                    });
                    child.on('error', (err: Error) => reject(err));
                });

                const outputStr = Buffer.concat(stdout).toString('utf8');
                const errorStr = Buffer.concat(stderr).toString('utf8');

                if (errorStr && !outputStr) {
                    console.error('[Architecture] CLI Stderr:', errorStr);
                }

                if (outputStr) {
                    try {
                        result = JSON.parse(outputStr);
                    } catch (e) {
                        console.error('[Architecture] Failed to parse JSON output:', e);
                        console.error('Output snippet:', outputStr.slice(0, 200));
                    }
                }

            } catch (e) {
                console.error('[Architecture] CLI Execution failed:', e);
                throw e;
            }
        }

        if (!result || result.outputType === 'err') {
            console.error('Dependency-cruiser failed or returned no result:', result);
            return [];
        }

        // 3. Process Result
        // ... (Mapping logic remains same)

        if (result.outputType === 'err') {
            console.error('Dependency-cruiser failed:', result);
            return [];
        }

        // Process violations from dependency-cruiser
        // dependency-cruiser reports violations on modules (files)

        // 1. Map Modules to our File IDs
        const moduleByPath = new Map<string, IModule>();

        if (result.output?.modules || result.modules) { // Handle both structures if CLI varies
            const modules = result.output?.modules || result.modules;
            for (const mod of modules as any[]) {
                const absPath = path.isAbsolute(mod.source)
                    ? mod.source
                    : path.resolve(effectiveBaseDir, mod.source);

                moduleByPath.set(absPath, mod);
            }
        }

        // 2. Process Forbidden Rules (Cycles, Layer Violations, Orphans)
        // cruise() API returns { output: { modules, summary } } not { modules, summary }
        // CLI JSON output: top level object has "modules" and "summary" directly usually?
        // Let's check CLI output structure. Usually it matches the API return type ICruiseResult.
        // ICruiseResult: { modules: ..., summary: ... }
        // But API execution wrapped it in { output: ... } in my previous code?
        // Wait, line 153 prev: `result.output?.summary || result.summary`.
        // So handling both is safe.

        const summary = result.output?.summary || result.summary;
        const violations = summary?.violations || [];


        if (violations.length > 0) {
            for (const violation of violations as any[]) {
                const sourceAbsPath = path.isAbsolute(violation.from)
                    ? violation.from
                    : path.resolve(effectiveBaseDir, violation.from);

                const sourceId = fileIdMap.get(sourceAbsPath);

                if (!sourceId) continue; // Skip if we don't track this file

                const relatedIds: string[] = [];
                let type: WarningType = 'unknown';
                let severity: WarningSeverity = 'medium';
                let cyclePath: string[] | undefined;
                let targetId: string | undefined;

                if (violation.to) {
                    const targetAbsPath = path.isAbsolute(violation.to)
                        ? violation.to
                        : path.resolve(effectiveBaseDir, violation.to);
                    targetId = fileIdMap.get(targetAbsPath);
                    if (targetId) relatedIds.push(targetId);
                }

                if (violation.cycle) {
                    // For cycles, add all participants as related
                    cyclePath = [];
                    for (const step of violation.cycle) {
                        const stepSource = typeof step === 'string' ? step : step.name || step.source;

                        const stepAbsPath = path.isAbsolute(stepSource)
                            ? stepSource
                            : path.resolve(effectiveBaseDir, stepSource);
                        const stepId = fileIdMap.get(stepAbsPath);
                        if (stepId) {
                            cyclePath.push(stepId);
                            if (stepId !== sourceId && !relatedIds.includes(stepId)) {
                                relatedIds.push(stepId);
                            }
                        }
                    }
                }

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

                // Construct a useful message
                let message = violation.comment || '';

                if (!message) {
                    if (type === 'layer-violation' && violation.to) {
                        const toName = path.basename(violation.to);
                        message = `Dependency on \`${toName}\` violates layer rules`;
                    } else if (type === 'circular-dependency') {
                        message = `Circular dependency detected`;
                    } else if (type === 'orphan') {
                        message = `Module has no incoming or outgoing dependencies`;
                    } else if (violation.to) {
                        const toName = path.basename(violation.to);
                        message = `Forbidden dependency on \`${toName}\``;
                    } else {
                        message = violation.rule.name;
                    }
                }

                warnings.push({
                    fileId: sourceId,
                    type,
                    message,
                    severity,
                    ruleName: violation.rule.name,
                    targetId,
                    cyclePath,
                    relatedFileIds: relatedIds
                });
            }
        }

        // 3. Custom Checks (Entry Bloat) - Dependency-cruiser counts dependencies too
        // We can iterate over modules to check for bloated entry points
        const ENTRY_BLOAT_THRESHOLD = 15;
        const modules = result.output?.modules || result.modules;
        if (modules) {
            for (const mod of modules as any[]) {
                // Determine absolute path
                const absPath = path.isAbsolute(mod.source)
                    ? mod.source
                    : path.resolve(effectiveBaseDir, mod.source);

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

        return warnings;
    } finally {
        if (perfStart !== undefined) {
            PerfTracker.instance?.stop(perfLabel, perfStart);
        }
    }
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
