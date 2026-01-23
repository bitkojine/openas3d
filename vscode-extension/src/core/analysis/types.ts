/**
 * Architecture Analysis Types
 * Separate file to avoid pulling Node.js dependencies into Webview
 */

import { ArchitectureWarning, WarningSeverity, WarningType } from '../../shared/types';
export { ArchitectureWarning, WarningSeverity, WarningType };

export interface FileWithZone {
    id: string;
    filePath: string;
    zone: string;
}

export interface ArchitectureDependency {
    sourceId: string;
    targetId: string;
}
