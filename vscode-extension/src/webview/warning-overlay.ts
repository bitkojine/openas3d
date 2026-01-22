/**
 * Warning Overlay UI
 * 
 * Displays architecture warnings in the 3D viewport:
 * - Collapsible warning panel in the corner
 * - Severity-based coloring
 */

import { ArchitectureWarning, WarningSeverity } from '../core/analysis/types';

const SEVERITY_COLORS: Record<WarningSeverity, string> = {
    high: '#ef4444',    // Red
    medium: '#f97316',  // Orange
    low: '#eab308'      // Yellow
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
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
        `;

        // Toggle button (always visible)
        this.toggleButton = document.createElement('button');
        this.toggleButton.style.cssText = `
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 8px 14px;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;
        this.toggleButton.onmouseenter = () => {
            this.toggleButton.style.background = 'rgba(50, 50, 50, 0.95)';
        };
        this.toggleButton.onmouseleave = () => {
            this.toggleButton.style.background = 'rgba(30, 30, 30, 0.95)';
        };
        this.toggleButton.onclick = () => this.toggle();

        // Expandable panel
        this.panel = document.createElement('div');
        this.panel.style.cssText = `
            background: rgba(30, 30, 30, 0.95);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            margin-bottom: 8px;
            max-height: 300px;
            overflow-y: auto;
            display: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        `;

        // Warnings list inside panel
        this.warningsList = document.createElement('div');
        this.warningsList.style.cssText = `
            padding: 8px 0;
        `;
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
            this.toggleButton.style.borderColor = 'rgba(34, 197, 94, 0.5)';
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
            badges += `<span style="background: ${SEVERITY_COLORS.low}; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 11px;">${summary.low}</span>`;
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
                <div style="padding: 12px 16px; color: rgba(255, 255, 255, 0.7);">
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
                    padding: 8px 16px;
                    color: rgba(255, 255, 255, 0.9);
                    cursor: pointer;
                    transition: background 0.15s ease;
                    border-left: 3px solid transparent;
                `;
                item.onmouseenter = () => {
                    item.style.background = 'rgba(255, 255, 255, 0.05)';
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

                item.innerHTML = `
                    <div style="font-size: 12px; line-height: 1.4;">${escapeHtml(warning.message)}</div>
                `;

                this.warningsList.appendChild(item);
            });
        });
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
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}
