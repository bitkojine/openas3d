import { ContextMenuItem } from '../services/context-menu-registry';
import { VisualObject } from '../objects/visual-object';

export class ContextMenu {
    private container: HTMLDivElement | null = null;
    private currentTarget: VisualObject | null = null;

    constructor() {
        this.handleClickOutside = this.handleClickOutside.bind(this);
    }

    public show(x: number, y: number, items: ContextMenuItem[], target: VisualObject): void {
        this.hide();

        if (items.length === 0) { return; }

        this.currentTarget = target;
        this.container = document.createElement('div');
        this.container.className = 'context-menu-container';

        // Basic styling via JS to ensure it works, but we should use CSS for polish
        Object.assign(this.container.style, {
            position: 'fixed',
            left: `${x}px`,
            top: `${y}px`,
            zIndex: '10000',
            background: 'var(--vscode-menu-background)',
            color: 'var(--vscode-menu-foreground)',
            border: '1px solid var(--vscode-menu-border)',
            borderRadius: '4px',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
            padding: '4px 0',
            minWidth: '160px',
            fontFamily: 'var(--vscode-font-family)',
            fontSize: 'var(--vscode-font-size)',
            userSelect: 'none'
        });

        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'context-menu-item';
            el.textContent = item.label;

            Object.assign(el.style, {
                padding: '6px 12px',
                cursor: 'pointer',
                transition: 'background 0.1s'
            });

            if (item.disabled) {
                el.style.opacity = '0.5';
                el.style.cursor = 'default';
            } else {
                el.onmouseenter = () => el.style.background = 'var(--vscode-menu-selectionBackground)';
                el.onmouseleave = () => el.style.background = 'transparent';
                el.onclick = (e) => {
                    e.stopPropagation();
                    item.action(target);
                    this.hide();
                };
            }

            this.container?.appendChild(el);
        });

        document.body.appendChild(this.container);

        // Prevent overflow
        const rect = this.container.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            this.container.style.left = `${window.innerWidth - rect.width - 4}px`;
        }
        if (rect.bottom > window.innerHeight) {
            this.container.style.top = `${window.innerHeight - rect.height - 4}px`;
        }

        // Global click-away
        setTimeout(() => {
            document.addEventListener('mousedown', this.handleClickOutside);
            document.addEventListener('contextmenu', this.handleClickOutside);
        }, 10);
    }

    public hide(): void {
        if (this.container) {
            this.container.remove();
            this.container = null;
            document.removeEventListener('mousedown', this.handleClickOutside);
            document.removeEventListener('contextmenu', this.handleClickOutside);
        }
        this.currentTarget = null;
    }

    private handleClickOutside(e: MouseEvent): void {
        if (this.container && !this.container.contains(e.target as Node)) {
            this.hide();
        }
    }
}
