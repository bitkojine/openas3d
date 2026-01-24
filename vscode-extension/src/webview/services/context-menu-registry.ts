import { VisualObject } from '../objects/visual-object';

export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: string;
    action: (obj: VisualObject) => void;
    category?: string;
    disabled?: boolean;
}

export type ContextMenuProvider = (obj: VisualObject) => ContextMenuItem[];

export class ContextMenuRegistry {
    private static instance: ContextMenuRegistry;
    private providers: { condition: (obj: VisualObject) => boolean, provider: ContextMenuProvider }[] = [];

    private constructor() { }

    public static getInstance(): ContextMenuRegistry {
        if (!ContextMenuRegistry.instance) {
            ContextMenuRegistry.instance = new ContextMenuRegistry();
        }
        return ContextMenuRegistry.instance;
    }

    /**
     * Register a new menu provider
     * @param condition Function that decides if this provider applies to the given object
     * @param provider Function that returns menu items
     */
    public registerProvider(condition: (obj: VisualObject) => boolean, provider: ContextMenuProvider): void {
        this.providers.push({ condition, provider });
    }

    /**
     * Get all applicable menu items for an object
     */
    public getMenuItems(obj: VisualObject): ContextMenuItem[] {
        const items: ContextMenuItem[] = [];
        for (const { condition, provider } of this.providers) {
            if (condition(obj)) {
                items.push(...provider(obj));
            }
        }
        return items;
    }
}
