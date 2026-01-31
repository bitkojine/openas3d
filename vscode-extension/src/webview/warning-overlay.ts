/**
 * Warning Overlay UI
 * 
 * Displays architecture warnings in the 3D viewport:
 * - Collapsible warning panel in the corner
 * - Severity-based coloring
 */

import { ArchitectureWarning, WarningSeverity } from '../core/analysis/types';

const SEVERITY_COLORS: Record<WarningSeverity, string> = {
    high: 'var(--vscode-editorError-foreground)',
    medium: 'var(--vscode-editorWarning-foreground)',
    low: 'var(--vscode-editorInfo-foreground)'
};

const SEVERITY_ICONS: Record<WarningSeverity, string> = {
    high: '⛔',
    medium: '⚠️',
    low: '💡'
};

/**
 * Creates and manages the warning overlay panel
 */
export class WarningOverlay {
    private container: HTMLDivElement;
    private warningsList: HTMLDivElement;
    private copyButton: HTMLButtonElement;
    private isCollapsed: boolean = true;
    private warnings: ArchitectureWarning[] = [];
    private onWarningClick?: (fileId: string) => void;

    constructor(parentElement: HTMLElement) {
        this.container = document.createElement('div');
        this.container.id = 'warning-overlay';
        this.container.className = 'micro-panel collapsed';
        Object.assign(this.container.style, {
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: '1000',
            background: 'var(--vscode-editorWidget-background)',
            color: 'var(--vscode-editorWidget-foreground)',
            fontFamily: 'var(--vscode-font-family)',
            fontSize: 'var(--vscode-font-size)',
            border: '1px solid var(--vscode-editorWidget-border)',
            borderRadius: '8px',
            boxShadow: '0 4px 12px var(--vscode-widget-shadow)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            width: '350px',
            maxHeight: '400px',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        });

        // Header
        const header = document.createElement('div');
        header.className = 'micro-panel-header';
        Object.assign(header.style, {
            padding: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            cursor: 'pointer',
            borderBottom: '1px solid var(--vscode-widget-border)',
            background: 'var(--vscode-editor-background)',
            borderRadius: '6px 6px 0 0'
        });
        header.onclick = () => this.toggleCollapse();

        const titleGroup = document.createElement('div');
        titleGroup.style.display = 'flex';
        titleGroup.style.alignItems = 'center';
        titleGroup.style.gap = '8px';

        const icon = document.createElement('div');
        icon.textContent = '🏛️';
        Object.assign(icon.style, {
            width: '20px',
            height: '20px',
            background: 'var(--vscode-button-secondaryBackground)',
            color: 'var(--vscode-button-secondaryForeground)',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px'
        });
        titleGroup.appendChild(icon);

        const title = document.createElement('h3');
        title.textContent = 'Architecture';
        Object.assign(title.style, {
            margin: '0',
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            fontWeight: '600'
        });
        titleGroup.appendChild(title);
        header.appendChild(titleGroup);

        this.container.appendChild(header);

        // Warnings list (Content)
        this.warningsList = document.createElement('div');
        this.warningsList.className = 'micro-panel-content';
        Object.assign(this.warningsList.style, {
            padding: '8px 0',
            overflowY: 'auto',
            maxHeight: '350px'
        });

        // Initialize Copy button (hidden by default inside collapsed content)
        this.copyButton = document.createElement('button');
        this.copyButton.textContent = '📋 Copy to Clipboard';
        this.copyButton.title = 'Copy warnings to clipboard';
        Object.assign(this.copyButton.style, {
            background: 'var(--vscode-button-secondaryBackground)',
            border: 'none',
            borderRadius: '4px',
            color: 'var(--vscode-button-secondaryForeground)',
            cursor: 'pointer',
            fontSize: '11px',
            padding: '6px 12px',
            margin: '8px 12px',
            width: 'calc(100% - 24px)',
            transition: 'all 0.2s ease',
            display: 'block'
        });
        this.copyButton.onmouseenter = () => {
            this.copyButton.style.background = 'var(--vscode-button-secondaryHoverBackground)';
        };
        this.copyButton.onmouseleave = () => {
            this.copyButton.style.background = 'var(--vscode-button-secondaryBackground)';
        };
        this.copyButton.onclick = () => this.copyWarnings();

        this.container.appendChild(this.warningsList);
        this.warningsList.appendChild(this.copyButton);

        parentElement.appendChild(this.container);
        this.updatePanel();
    }

    private toggleCollapse(): void {
        this.isCollapsed = !this.isCollapsed;
        this.container.classList.toggle('collapsed', this.isCollapsed);
    }

    /**
     * Set click handler for warning items
     */
    public setOnWarningClick(handler: (fileId: string) => void): void {
        this.onWarningClick = handler;
    }

    /**
     * Update warnings display
     */
    public setWarnings(warnings: ArchitectureWarning[]): void {
        this.warnings = warnings;
        this.updateHeader();
        this.updatePanel();
    }

    /**
     * Update header appearance based on issues
     */
    private updateHeader(): void {
        const summary = {
            high: this.warnings.filter(w => w.severity === 'high').length,
            medium: this.warnings.filter(w => w.severity === 'medium').length,
            low: this.warnings.filter(w => w.severity === 'low').length
        };
        const total = summary.high + summary.medium + summary.low;

        const icon = this.container.querySelector('.micro-panel-header div:first-child div') as HTMLElement;
        if (icon) {
            if (total === 0) {
                icon.textContent = '✅';
            } else {
                icon.textContent = '🏛️';
            }
            icon.style.background = 'var(--vscode-button-secondaryBackground)';
            icon.style.color = 'var(--vscode-button-secondaryForeground)';
        }

        const title = this.container.querySelector('h3') as HTMLElement;
        if (title) {
            title.textContent = total > 0 ? `Issues (${total})` : 'No Issues';
        }
    }

    /**
     * Update panel content
     */
    private updatePanel(): void {
        this.warningsList.innerHTML = '';

        if (this.warnings.length === 0) {
            this.copyButton.style.display = 'none';
            this.warningsList.innerHTML = `
                <div style="padding: 12px 16px; color: var(--vscode-descriptionForeground);">
                    No architecture issues detected.
                </div>
            `;
            return;
        }

        // Prepend Copy button to the list
        this.copyButton.style.display = 'block';
        this.warningsList.appendChild(this.copyButton);

        // Group by severity
        const bySeverity = {
            high: this.warnings.filter(w => w.severity === 'high'),
            medium: this.warnings.filter(w => w.severity === 'medium'),
            low: this.warnings.filter(w => w.severity === 'low')
        };

        // Render each severity group
        (['high', 'medium', 'low'] as WarningSeverity[]).forEach(severity => {
            const items = bySeverity[severity];
            if (items.length === 0) { return; }

            // Section header
            const header = document.createElement('div');
            header.style.cssText = `
                padding: 8px 16px 4px;
                color: ${SEVERITY_COLORS[severity]};
                font-weight: 600;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            `;
            header.textContent = `${SEVERITY_ICONS[severity]} ${severity} (${items.length})`;
            this.warningsList.appendChild(header);

            // Warning items
            items.forEach(warning => {
                const item = document.createElement('div');
                item.style.cssText = `
                    padding: 8px 12px;
                    color: var(--vscode-notifications-foreground);
                    cursor: pointer;
                    transition: background 0.15s ease;
                    border-left: 3px solid transparent;
                    border-bottom: 1px solid var(--vscode-tree-indentGuidesStroke);
                `;
                item.onmouseenter = () => {
                    item.style.background = 'var(--vscode-list-hoverBackground)';
                    item.style.borderLeftColor = SEVERITY_COLORS[severity];
                };
                item.onmouseleave = () => {
                    item.style.background = 'transparent';
                    item.style.borderLeftColor = 'transparent';
                };
                item.onclick = () => {
                    if (this.onWarningClick) {
                        this.onWarningClick(warning.fileId);
                    }
                };

                // Rich content details
                let details = '';

                // Add cycle information if available
                if (warning.cyclePath && warning.cyclePath.length > 0) {
                    const cycleSteps = warning.cyclePath.map(id => {
                        // Extract filename from IDs (assuming ID is path for now, or simplify)
                        return id.split('/').pop() || id;
                    }).join(' <span style="color: rgba(255,255,255,0.4)">→</span> ');
                    details += `
                        <div style="margin-top: 4px; padding: 4px; background: var(--vscode-textBlockQuote-background); border-radius: 3px; font-family: var(--vscode-editor-font-family); font-size: 90%; overflow-x: auto;">
                            🔄 Cycle: ${cycleSteps}
                        </div>
                    `;
                }

                // Add rule name badge
                const ruleBadge = warning.ruleName ?
                    `<span style="
                        display: inline-block;
                        background: var(--vscode-badge-background);
                        color: var(--vscode-badge-foreground); 
                        padding: 1px 4px; 
                        border-radius: 3px; 
                        font-size: 90%; 
                        margin-right: 6px; 
                        opacity: 0.9;
                    ">${formatMessage(warning.ruleName)}</span>` : '';

                // Clean message (remove rule name prefix if it was added in analyzer)
                let message = warning.message;
                if (warning.ruleName && message.startsWith(warning.ruleName + ':')) {
                    message = message.substring(warning.ruleName.length + 1).trim();
                }

                item.innerHTML = `
                    <div style="font-size: 12px; line-height: 1.4;">
                        <div style="margin-bottom: 2px;">${ruleBadge}${formatMessage(message)}</div>
                        ${details}
                    </div>
                `;

                this.warningsList.appendChild(item);
            });
        });
    }

    /**
     * Copy warnings to clipboard
     */
    private async copyWarnings(): Promise<void> {
        if (this.warnings.length === 0) { return; }

        const lines: string[] = [];
        lines.push('# Architecture Warnings\n');

        const bySeverity = {
            high: this.warnings.filter(w => w.severity === 'high'),
            medium: this.warnings.filter(w => w.severity === 'medium'),
            low: this.warnings.filter(w => w.severity === 'low')
        };

        // Format each group
        (['high', 'medium', 'low'] as WarningSeverity[]).forEach(severity => {
            const items = bySeverity[severity];
            if (items.length === 0) { return; }

            lines.push(`## ${SEVERITY_ICONS[severity]} ${severity.toUpperCase()} (${items.length})`);

            items.forEach(w => {
                let msg = w.message;
                if (w.ruleName && msg.startsWith(w.ruleName + ':')) {
                    msg = msg.substring(w.ruleName.length + 1).trim();
                }

                lines.push(`- **${w.ruleName || 'Warning'}**: ${msg}`);

                if (w.cyclePath && w.cyclePath.length > 0) {
                    const path = w.cyclePath.map(p => p.split('/').pop() || p).join(' -> ');
                    lines.push(`  - Cycle: ${path}`);
                }
            });
            lines.push('');
        });

        const text = lines.join('\n');

        try {
            await navigator.clipboard.writeText(text);

            // Temporary feedback
            const originalText = this.copyButton.innerHTML;
            this.copyButton.innerHTML = '✅ Copied!';
            this.copyButton.style.borderColor = 'var(--vscode-debugIcon-startForeground)';
            this.copyButton.style.color = 'var(--vscode-debugIcon-startForeground)';

            setTimeout(() => {
                this.copyButton.textContent = originalText;
                this.copyButton.style.color = 'var(--vscode-button-secondaryForeground)';
            }, 2000);

        } catch (err) {
            console.error('Failed to copy warnings:', err);
            this.copyButton.innerHTML = '❌ Error';
            setTimeout(() => {
                this.copyButton.innerHTML = '📋 Copy';
            }, 2000);
        }
    }

    /**
     * Show/hide the overlay
     */
    public setVisible(visible: boolean): void {
        this.container.style.display = visible ? 'block' : 'none';
    }

    /**
     * Cleanup
     */
    public dispose(): void {
        this.container.remove();
    }
}

/**
 * Escape HTML special characters
 */
function formatMessage(text: string): string {
    const escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    // Replace backticks with code tags
    return escaped.replace(/`([^`]+)`/g, (_match, code) => {
        return `<span style="
            font-family: var(--vscode-editor-font-family);
            background: var(--vscode-textBlockQuote-background);
            padding: 1px 4px;
            border-radius: 3px;
            font-size: 0.9em;
            color: var(--vscode-textBlockQuote-border);
        ">${code}</span>`;
    });
}
