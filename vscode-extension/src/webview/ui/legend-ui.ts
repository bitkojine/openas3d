import { WebviewMessage } from '../../shared/messages';

export class LegendUI {
    private container: HTMLElement;
    public isCollapsed = false;

    constructor(parentElement: HTMLElement) {
        this.container = document.createElement('div');
        this.container.id = 'controls-legend';
        this.container.className = 'micro-panel';
        Object.assign(this.container.style, {
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            zIndex: '1000',
            background: 'var(--vscode-editorWidget-background)',
            color: 'var(--vscode-editor-foreground)',
            border: '1px solid var(--vscode-editorWidget-border)',
            borderRadius: '8px',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 4px 16px var(--vscode-widget-shadow)',
            display: 'flex',
            flexDirection: 'column',
            width: '240px'
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
            borderBottom: '1px solid var(--vscode-editorWidget-border)',
            background: 'var(--vscode-editor-background)',
            borderRadius: '8px 8px 0 0'
        });
        header.onclick = () => this.toggleCollapse();

        const titleGroup = document.createElement('div');
        titleGroup.style.display = 'flex';
        titleGroup.style.alignItems = 'center';
        titleGroup.style.gap = '8px';

        const icon = document.createElement('div');
        icon.textContent = '⌨️';
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
        title.textContent = 'Controls';
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

        // Content
        const content = document.createElement('div');
        content.className = 'micro-panel-content';
        content.style.padding = '12px';
        content.innerHTML = `
            <div style="display:grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 11px;">
                <span style="color:var(--vscode-descriptionForeground)">WASD</span> <span>Move</span>
                <span style="color:var(--vscode-descriptionForeground)">Space</span> <span>Jump / Up</span>
                <span style="color:var(--vscode-descriptionForeground)">C</span> <span>Down</span>
                <span style="color:var(--vscode-descriptionForeground)">F</span> <span>Flight Mode</span>
                <span style="color:var(--vscode-descriptionForeground)">Click</span> <span>Select / Look</span>
                <span style="color:var(--vscode-descriptionForeground)">Right-Clk</span> <span>Menu</span>
                <span style="color:var(--vscode-descriptionForeground)">Double</span> <span>Open File</span>
                <span style="color:var(--vscode-descriptionForeground)">Shift+Drag</span> <span>Move Object</span>
                <span style="color:var(--vscode-descriptionForeground)">E</span> <span>Place Sign</span>
                <span style="color:var(--vscode-descriptionForeground)">Esc</span> <span>Release Mouse</span>
            </div>
        `;
        this.container.appendChild(content);

        parentElement.appendChild(this.container);
    }

    public toggleCollapse(): void {
        this.setCollapsed(!this.isCollapsed);
    }

    public setCollapsed(collapsed: boolean): void {
        this.isCollapsed = collapsed;
        this.container.classList.toggle('collapsed', this.isCollapsed);
    }
}
