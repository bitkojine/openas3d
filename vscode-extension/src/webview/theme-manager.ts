import * as THREE from 'three';
import { ThemeColors } from '../shared/types';

/**
 * Manages theme synchronization between VSCode and the 3D world.
 * Detects theme changes via CSS variables and propagates them.
 */
export class ThemeManager {
    private currentTheme: ThemeColors;
    private listeners: ((theme: ThemeColors) => void)[] = [];
    private observer: MutationObserver | null = null;

    constructor() {
        this.currentTheme = this.readThemeColors();
        this.startObserving();
    }

    /**
     * Get the current theme colors
     */
    public getTheme(): ThemeColors {
        return this.currentTheme;
    }

    /**
     * Subscribe to theme changes
     */
    public onThemeChange(callback: (theme: ThemeColors) => void): void {
        this.listeners.push(callback);
    }

    public dispose(): void {
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        this.listeners = [];
    }

    /**
     * Start observing DOM changes to detect theme switches
     */
    private startObserving(): void {
        this.observer = new MutationObserver(() => {
            const newTheme = this.readThemeColors();
            if (this.hasThemeChanged(this.currentTheme, newTheme)) {
                this.currentTheme = newTheme;
                this.notifyListeners();
            }
        });

        // Watch for class changes on body (vscode-light/dark/high-contrast usually toggle here)
        // Also watch style attribute in case variables are updated directly on body/root
        if (this.observer) {
            this.observer.observe(document.body, {
                attributes: true,
                attributeFilter: ['class', 'style'],
                subtree: false
            });

            // Also watch html element as some themes might apply there
            if (document.documentElement) {
                this.observer.observe(document.documentElement, {
                    attributes: true,
                    attributeFilter: ['class', 'style'],
                    subtree: false
                });
            }
        }
    }

    /**
     * Read VSCode theme colors from CSS variables
     */
    private readThemeColors(): ThemeColors {
        const style = getComputedStyle(document.documentElement);
        const isDark = this.isDarkTheme();

        // Helper to get variable or fallback
        const getVar = (name: string, fallback: string) => {
            const val = style.getPropertyValue(name).trim();
            return val || fallback;
        };

        const editorBg = getVar('--vscode-editor-background', '#1e1e1e');
        const activityBg = getVar('--vscode-activityBar-background', '#333333');
        const fg = getVar('--vscode-editor-foreground', '#cccccc');

        // Core colors from VSCode
        const colEditor = new THREE.Color(editorBg);
        const colActivity = new THREE.Color(activityBg);

        // --- 1. SKY COLORS ---
        // Sky Top IS the editor background (seamless transition)
        const skyTop = colEditor.clone();
        // Clamp sky luma to avoid absolute void or blinding white
        const skyHSL = { h: 0, s: 0, l: 0 };
        skyTop.getHSL(skyHSL);
        // Reduce max lightness to 0.92 to distinguish from potential white UI elements
        skyHSL.l = Math.max(0.05, Math.min(0.92, skyHSL.l));
        skyTop.setHSL(skyHSL.h, skyHSL.s, skyHSL.l);

        // Sky Horizon: Blend of editor and activity bar
        const skyHorizon = colEditor.clone().lerp(colActivity, 0.5);
        skyHorizon.offsetHSL(0, 0.1, isDark ? 0.2 : -0.1);

        // Sky Ground: Complementary hue
        const skyGround = colEditor.clone().offsetHSL(0.5, 0, -0.2);

        // --- 2. ENVIRONMENT COLORS ---
        // Grass follows theme tint
        const grassBase = colEditor.clone();
        const grassHSL = { h: 0, s: 0, l: 0 };
        grassBase.getHSL(grassHSL);

        // Enforce visibility
        if (grassHSL.s < 0.1) {grassHSL.s = 0.1;}

        // Luminance sweet spot for ground - CLAMPED for visibility
        if (isDark) {
            // Avoid pitch black grass
            grassHSL.l = Math.max(0.15, Math.min(0.35, grassHSL.l));
        } else {
            // Avoid neon white grass, ensure contrast with sky
            grassHSL.l = Math.max(0.35, Math.min(0.65, grassHSL.l));
        }

        const grassColor = new THREE.Color().setHSL(grassHSL.h, grassHSL.s, grassHSL.l);
        const grassShadow = grassColor.clone().offsetHSL(0, 0, -0.15);
        const grassHighlight = grassColor.clone().offsetHSL(0, 0, 0.15);

        // --- 3. MOUNTAINS ---
        const mountColor = colActivity.clone();

        // --- 4. TREES ---
        const treeFoliage = grassColor.clone().offsetHSL(0, 0, -0.2);
        const treeTrunk = colActivity.clone().offsetHSL(0, -0.5, -0.2);

        // --- 5. VISUALS ---
        const fencePost = colActivity.clone();
        const fenceRail = colActivity.clone().offsetHSL(0, 0, 0.1);

        // --- 6. PATHWAY ---
        // Ensure contrast against grass
        // TODO: Could dynamically derive this too, but simple grey is safe for contrast.
        // Let's tint it slightly with theme
        const pathColor = colActivity.clone();
        const pathHSL = { h: 0, s: 0, l: 0 };
        pathColor.getHSL(pathHSL);
        pathHSL.s *= 0.2; // Desaturate
        // Light mode path should be darker to stand out against light grass/sky
        pathHSL.l = isDark ? 0.25 : 0.5;
        pathColor.setHSL(pathHSL.h, pathHSL.s, pathHSL.l);

        return {
            background: editorBg,
            foreground: fg,
            editorBackground: editorBg,
            editorForeground: fg,
            activityBarBackground: activityBg,
            statusBarBackground: getVar('--vscode-statusBar-background', '#007acc'),
            selectionBackground: getVar('--vscode-editor-selectionBackground', '#264f78'),

            skyTop: '#' + skyTop.getHexString(),
            skyHorizon: '#' + skyHorizon.getHexString(),
            skyGround: '#' + skyGround.getHexString(),

            grassColor: '#' + grassColor.getHexString(),
            grassShadow: '#' + grassShadow.getHexString(),
            grassHighlight: '#' + grassHighlight.getHexString(),

            mountainColor: '#' + mountColor.getHexString(),
            mountainSnow: isDark ? '#' + skyHorizon.getHexString() : '#ffffff',

            treeTrunk: '#' + treeTrunk.getHexString(),
            treeFoliage: '#' + treeFoliage.getHexString(),

            fencePost: '#' + fencePost.getHexString(),
            fenceRail: '#' + fenceRail.getHexString(),
            signPost: '#' + fencePost.getHexString(),
            signBoard: '#' + fenceRail.getHexString(),
            signText: '#ffffff',

            pathway: '#' + pathColor.getHexString(),

            // Labels - High contrast match
            labelColor: fg,
            labelBackground: editorBg,
            labelBorder: activityBg
        };
    }


    private isDarkTheme(): boolean {
        return document.body.classList.contains('vscode-dark') ||
            document.body.classList.contains('vscode-high-contrast');
    }

    private hasThemeChanged(oldTheme: ThemeColors, newTheme: ThemeColors): boolean {
        return JSON.stringify(oldTheme) !== JSON.stringify(newTheme);
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.currentTheme));
    }
}
