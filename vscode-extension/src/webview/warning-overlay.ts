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
    private panel: HTMLDivElement;
    private toggleButton: HTMLButtonElement;
    private warningsList: HTMLDivElement;
    private copyButton: HTMLButtonElement;
    private isExpanded: boolean = false;
    private warnings: ArchitectureWarning[] = [];
    private onWarningClick?: (fileId: string) => void;

    constructor(parentElement: HTMLElement) {
        this.container = document.createElement('div');
        this.container.id = 'warning-overlay';
        this.container.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 1000;
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-editor-foreground);
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        `;

        // Toggle button (always visible)
        this.toggleButton = document.createElement('button');
        this.toggleButton.style.cssText = `
            background: var(--vscode-notifications-background);
            border: 1px solid var(--vscode-widget-border);
            border-radius: 4px;
            padding: 6px 10px;
            color: var(--vscode-notifications-foreground);
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-family: inherit;
            font-size: inherit;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        `;
        this.toggleButton.onmouseenter = () => {
            this.toggleButton.style.boxShadow = '0 0 8px rgba(0,0,0,0.2)';
        };
        this.toggleButton.onmouseleave = () => {
            this.toggleButton.style.background = 'var(--vscode-notifications-background)';
        };
        this.toggleButton.onclick = () => this.toggle();

        // Expandable panel
        this.panel = document.createElement('div');
        this.panel.style.cssText = `
            background: var(--vscode-notifications-background);
            border: 1px solid var(--vscode-widget-border);
            color: var(--vscode-notifications-foreground);
            border-radius: 4px;
            margin-bottom: 8px;
            max-height: 300px;
            max-width: 600px;
            overflow-y: auto;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
            word-break: break-word;
        `;

        // Warnings list inside panel
        this.warningsList = document.createElement('div');
        this.warningsList.style.cssText = `
            padding: 8px 0;
            max-height: 250px;
            overflow-y: auto;
        `;

        // Panel header with Copy button
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            border-bottom: 1px solid var(--vscode-widget-border);
            background: var(--vscode-editor-background);
            border-radius: 4px 4px 0 0;
            opacity: 0.9;
        `;

        const title = document.createElement('span');
        title.style.cssText = `
            font-weight: 600;
            color: var(--vscode-editor-foreground);
        `;
        title.textContent = 'Architecture Issues';

        this.copyButton = document.createElement('button');
        this.copyButton.innerHTML = '📋 Copy';
        this.copyButton.title = 'Copy warnings to clipboard';
        this.copyButton.style.cssText = `
            background: var(--vscode-button-secondaryBackground);
            border: 1px solid transparent;
            border-radius: 2px;
            padding: 2px 8px;
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-size: 11px;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 4px;
        `;
        this.copyButton.onmouseenter = () => {
            this.copyButton.style.background = 'var(--vscode-button-secondaryHoverBackground)';
            this.copyButton.style.color = 'var(--vscode-button-secondaryForeground)';
        };
        this.copyButton.onmouseleave = () => {
            this.copyButton.style.background = 'var(--vscode-button-secondaryBackground)';
            this.copyButton.style.color = 'var(--vscode-button-secondaryForeground)';
        };
        this.copyButton.onclick = () => this.copyWarnings();

        header.appendChild(title);
        header.appendChild(this.copyButton);
        this.panel.appendChild(header);
        this.panel.appendChild(this.warningsList);

        this.container.appendChild(this.panel);
        this.container.appendChild(this.toggleButton);
        parentElement.appendChild(this.container);

        this.updateButton();
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
        this.updateButton();
        this.updatePanel();
    }

    /**
     * Toggle panel visibility
     */
    private toggle(): void {
        this.isExpanded = !this.isExpanded;
        this.panel.style.display = this.isExpanded ? 'block' : 'none';
        this.updateButton();
    }

    /**
     * Update toggle button appearance
     */
    private updateButton(): void {
        const summary = {
            high: this.warnings.filter(w => w.severity === 'high').length,
            medium: this.warnings.filter(w => w.severity === 'medium').length,
            low: this.warnings.filter(w => w.severity === 'low').length
        };
        const total = summary.high + summary.medium + summary.low;

        if (total === 0) {
            this.toggleButton.innerHTML = `✅ <span>No Issues</span>`;
            this.toggleButton.style.borderColor = 'var(--vscode-debugIcon-startForeground)';
            return;
        }

        // Build badge HTML
        let badges = '';
        if (summary.high > 0) {
            badges += `<span style="background: ${SEVERITY_COLORS.high}; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${summary.high}</span>`;
        }
        if (summary.medium > 0) {
            badges += `<span style="background: ${SEVERITY_COLORS.medium}; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${summary.medium}</span>`;
        }
        if (summary.low > 0) {
            badges += `<span style="background: ${SEVERITY_COLORS.low}; color: var(--vscode-editor-background); padding: 2px 6px; border-radius: 4px; font-size: 11px;">${summary.low}</span>`;
        }

        const arrow = this.isExpanded ? '▼' : '▲';
        this.toggleButton.innerHTML = `
            ⚠️ <span>Architecture Issues</span>
            <span style="display: flex; gap: 4px;">${badges}</span>
            <span style="opacity: 0.5;">${arrow}</span>
        `;

        // Set border color based on highest severity
        if (summary.high > 0) {
            this.toggleButton.style.borderColor = SEVERITY_COLORS.high;
        } else if (summary.medium > 0) {
            this.toggleButton.style.borderColor = SEVERITY_COLORS.medium;
        } else {
            this.toggleButton.style.borderColor = SEVERITY_COLORS.low;
        }
    }

    /**
     * Update panel content
     */
    private updatePanel(): void {
        this.warningsList.innerHTML = '';

        if (this.warnings.length === 0) {
            this.warningsList.innerHTML = `
                <div style="padding: 12px 16px; color: var(--vscode-descriptionForeground);">
                    No architecture issues detected.
                </div>
            `;
            return;
        }

        // Group by severity
        const bySeverity = {
            high: this.warnings.filter(w => w.severity === 'high'),
            medium: this.warnings.filter(w => w.severity === 'medium'),
            low: this.warnings.filter(w => w.severity === 'low')
        };

        // Render each severity group
        (['high', 'medium', 'low'] as WarningSeverity[]).forEach(severity => {
            const items = bySeverity[severity];
            if (items.length === 0) return;

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
        if (this.warnings.length === 0) return;

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
            if (items.length === 0) return;

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
                this.copyButton.innerHTML = originalText;
                this.copyButton.style.borderColor = 'transparent';
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
