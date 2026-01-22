/**
 * @deprecated Import from '../core/analysis' instead.
 * This file re-exports for backward compatibility.
 */
export {
    analyzeArchitecture,
    getWarningsByFile,
    getWarningSummary
} from '../core/analysis/architecture-analyzer';

export {
    WarningSeverity,
    WarningType,
    ArchitectureWarning,
    FileWithZone,
    ArchitectureDependency
} from '../core/analysis/types';

// Backward-compatible alias
export { ArchitectureDependency as Dependency } from '../core/analysis/types';
