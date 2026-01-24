import { WebviewMessage } from '../../shared/messages';

export class TddUi {
    private container: HTMLElement;
    private list: HTMLElement;
    private isVisible = true;

    constructor(private postMessage: (msg: WebviewMessage) => void) {
        this.container = document.createElement('div');
        this.container.style.position = 'fixed';
        this.container.style.top = '20px';
        this.container.style.left = '20px';
        this.container.style.width = '400px';
        this.container.style.background = 'var(--vscode-notifications-background)';
        this.container.style.backdropFilter = 'blur(10px)';
        this.container.style.border = '1px solid var(--vscode-widget-border)';
        this.container.style.borderRadius = '6px';
        this.container.style.padding = '0'; // Use padding in inner elements
        this.container.style.fontFamily = 'var(--vscode-font-family)';
        this.container.style.fontSize = 'var(--vscode-font-size)';
        this.container.style.color = 'var(--vscode-notifications-foreground)';
        this.container.style.zIndex = '1000';
        this.container.style.maxHeight = '50vh';
        this.container.style.display = 'flex';
        this.container.style.flexDirection = 'column';
        this.container.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.25)';

        // Header
        const header = document.createElement('div');
        header.style.padding = '12px';
        header.style.borderBottom = '1px solid var(--vscode-widget-border)';
        header.style.background = 'var(--vscode-editor-background)';
        header.style.borderRadius = '6px 6px 0 0';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';

        const title = document.createElement('h3');
        title.textContent = 'Business Rules';
        title.style.margin = '0';
        title.style.fontSize = '12px';
        title.style.fontWeight = '600';
        title.style.textTransform = 'uppercase';
        title.style.letterSpacing = '0.5px';
        header.appendChild(title);

        this.container.appendChild(header);

        // List
        this.list = document.createElement('div');
        this.list.style.overflowY = 'auto';
        this.list.style.flex = '1';
        this.list.style.padding = '8px 0';
        this.list.innerHTML = '<div style="color: var(--vscode-descriptionForeground); font-style: italic; padding: 12px;">No tests discovered yet...</div>';
        this.container.appendChild(this.list);

        // Controls
        const controls = document.createElement('div');
        controls.style.padding = '12px';
        controls.style.borderTop = '1px solid var(--vscode-widget-border)';
        controls.style.display = 'flex';
        controls.style.gap = '8px';
        controls.style.background = 'var(--vscode-editor-background)';
        controls.style.borderRadius = '0 0 6px 6px';

        const runAllBtn = this.createButton('Run All', 'primary', () => {
            this.postMessage({ type: 'runAllTests' });
        });

        controls.appendChild(runAllBtn);
        this.container.appendChild(controls);

        document.body.appendChild(this.container);
    }

    private createButton(text: string, kind: 'primary' | 'secondary', onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.textContent = text;

        const isPrimary = kind === 'primary';
        const bg = isPrimary ? 'var(--vscode-button-background)' : 'var(--vscode-button-secondaryBackground)';
        const hoverBg = isPrimary ? 'var(--vscode-button-hoverBackground)' : 'var(--vscode-button-secondaryHoverBackground)';
        const fg = isPrimary ? 'var(--vscode-button-foreground)' : 'var(--vscode-button-secondaryForeground)';

        btn.style.background = bg;
        btn.style.color = fg;
        btn.style.border = 'none';
        btn.style.borderRadius = '2px';
        btn.style.padding = '4px 12px';
        btn.style.cursor = 'pointer';
        btn.style.fontSize = '11px';
        btn.style.fontFamily = 'inherit';

        btn.onmouseenter = () => btn.style.background = hoverBg;
        btn.onmouseleave = () => btn.style.background = bg;
        btn.onclick = onClick;

        return btn;
    }


    public updateTests(tests: any[]) {
        this.list.innerHTML = '';

        if (tests.length === 0) {
            this.list.innerHTML = '<div style="color: var(--vscode-descriptionForeground); font-style: italic; padding: 12px;">No tests discovered yet...</div>';
            return;
        }

        // Calculate groups
        const failed = tests.filter(t => t.status === 'failed').sort((a, b) => a.label.localeCompare(b.label));
        const running = tests.filter(t => t.status === 'running').sort((a, b) => a.label.localeCompare(b.label));
        const passed = tests.filter(t => t.status === 'passed');
        const sortedAll = [...tests].sort((a, b) => a.label.localeCompare(b.label));

        const isAnyRunning = running.length > 0;
        const totalDiscovered = tests.length;

        const renderGroup = (title: string, groupTests: any[], options: { color?: string, forceShow?: boolean, placeholder?: string, showCount?: boolean } = {}) => {
            const { color, forceShow = false, placeholder, showCount = true } = options;

            if (groupTests.length === 0 && !forceShow) return;

            const groupHeader = document.createElement('div');
            groupHeader.style.padding = '8px 12px 4px';
            groupHeader.style.fontSize = '10px';
            groupHeader.style.fontWeight = '700';
            groupHeader.style.textTransform = 'uppercase';
            groupHeader.style.color = color || 'var(--vscode-descriptionForeground)';
            groupHeader.style.opacity = '0.7';

            const countStr = showCount && groupTests.length > 0 ? ` (${groupTests.length})` : '';
            groupHeader.textContent = `${title}${countStr}`;

            this.list.appendChild(groupHeader);

            if (groupTests.length === 0 && placeholder) {
                const div = document.createElement('div');
                div.style.padding = '8px 16px';
                div.style.fontSize = '11px';
                div.style.color = 'var(--vscode-descriptionForeground)';
                div.style.opacity = '0.6';
                div.textContent = placeholder;
                this.list.appendChild(div);
                return;
            }

            const ul = document.createElement('ul');
            ul.style.listStyle = 'none';
            ul.style.padding = '0';
            ul.style.margin = '0';

            groupTests.forEach(test => {
                const li = document.createElement('li');
                li.style.padding = '6px 16px';
                li.style.borderBottom = '1px solid var(--vscode-tree-indentGuidesStroke)';
                li.style.fontSize = '12px';
                li.style.display = 'flex';
                li.style.alignItems = 'flex-start';
                li.style.justifyContent = 'space-between';
                li.style.transition = 'background 0.1s ease';

                li.onmouseenter = () => li.style.background = 'var(--vscode-list-hoverBackground)';
                li.onmouseleave = () => li.style.background = 'transparent';

                const nameSpan = document.createElement('span');
                nameSpan.textContent = test.label;
                nameSpan.title = test.id;
                nameSpan.style.wordBreak = 'break-word';
                nameSpan.style.marginRight = '12px';
                nameSpan.style.flex = '1';
                nameSpan.style.fontSize = '11px';
                nameSpan.style.lineHeight = '1.4';
                nameSpan.style.color = 'var(--vscode-notifications-foreground)';

                const statusSpan = document.createElement('span');
                statusSpan.style.fontSize = '14px';
                statusSpan.style.flexShrink = '0';

                if (test.status === 'passed') {
                    statusSpan.textContent = '✓';
                    statusSpan.style.color = 'var(--vscode-testing-iconPassedColor, #22c55e)';
                } else if (test.status === 'failed') {
                    statusSpan.textContent = '✕';
                    statusSpan.style.color = 'var(--vscode-testing-iconFailedColor, #ef4444)';
                } else if (test.status === 'running') {
                    statusSpan.textContent = '●';
                    statusSpan.style.color = 'var(--vscode-testing-iconQueuedColor, #eab308)';
                    statusSpan.style.animation = 'pulse 1s infinite alternate';
                } else {
                    statusSpan.textContent = '○';
                    statusSpan.style.color = 'var(--vscode-descriptionForeground)';
                    statusSpan.style.opacity = '0.5';
                }

                li.appendChild(nameSpan);
                li.appendChild(statusSpan);
                ul.appendChild(li);
            });

            this.list.appendChild(ul);
        };

        // 1. Running Status: No count, stable, shows running or stats
        const statusPlaceholder = isAnyRunning ? undefined :
            `Last Run: ${passed.length} Passed, ${failed.length} Failed (Total ${totalDiscovered})`;

        renderGroup('Running Status', running, {
            color: 'var(--vscode-testing-iconQueuedColor)',
            forceShow: true,
            placeholder: statusPlaceholder,
            showCount: false // Requested: no count for running
        });

        // 2. Failed: Only shown if there are failures
        renderGroup('Failed', failed, {
            color: 'var(--vscode-testing-iconFailedColor)'
        });

        // 3. Tests Pool: Stable total count
        const poolTests = sortedAll.filter(t => t.status !== 'failed');
        renderGroup('Tests Pool', poolTests, {
            showCount: true // Use count but we'll override text potentially? 
        });

        // Let's manually fix the header for Pool to show TOTAL count as requested
        const headers = this.list.querySelectorAll('div');
        headers.forEach(h => {
            if (h.textContent?.startsWith('Tests Pool')) {
                h.textContent = `Tests Pool (${totalDiscovered})`;
            }
        });

        // Add pulse animation if not exists
        if (!document.getElementById('tdd-animations')) {
            const style = document.createElement('style');
            style.id = 'tdd-animations';
            style.innerHTML = `
                @keyframes pulse {
                    from { opacity: 0.4; }
                    to { opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
    }
}
