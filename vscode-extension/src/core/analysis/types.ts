/**
 * Architecture Analysis Types
 * Separate file to avoid pulling Node.js dependencies into Webview
 */

export type WarningSeverity = 'high' | 'medium' | 'low';
export type WarningType = 'layer-violation' | 'circular-dependency' | 'entry-bloat' | 'orphan' | 'unknown';

export interface ArchitectureWarning {
    fileId: string;
    type: WarningType;
    message: string;
    severity: WarningSeverity;
    ruleName?: string;
    cyclePath?: string[]; // List of file IDs in the cycle
    targetId?: string;    // Target file ID for edge violations
    relatedFileIds?: string[];
}

export interface FileWithZone {
    id: string;
    filePath: string;
    zone: string;
}

export interface ArchitectureDependency {
    sourceId: string;
    targetId: string;
}
