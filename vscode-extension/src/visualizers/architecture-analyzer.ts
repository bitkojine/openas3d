/**
 * @deprecated Import from '../core/analysis' instead.
 * This file re-exports for backward compatibility.
 */
export {
    WarningSeverity,
    WarningType,
    ArchitectureWarning,
    FileWithZone,
    ArchitectureDependency,
    analyzeArchitecture,
    getWarningsByFile,
    getWarningSummary
} from '../core/analysis/architecture-analyzer';

// Backward-compatible alias
export { ArchitectureDependency as Dependency } from '../core/analysis/architecture-analyzer';
