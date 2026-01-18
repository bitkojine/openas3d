import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { CodebaseVisualizer } from './codebase';

export interface VisualizerManifest {
    name: string;
    type: string;
    version: string;
    languages?: string[];
    description: string;
}

export interface WorldVisualizer {
    manifest: VisualizerManifest;
    initialize(panel: vscode.WebviewPanel, data: any): Promise<() => void>;
}

export class ExtensionLoader {
    private context: vscode.ExtensionContext;
    private visualizers: Map<string, WorldVisualizer> = new Map();
    private activeCleanupFunctions: (() => void)[] = [];

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.initializeBuiltInVisualizers();
    }

    private initializeBuiltInVisualizers(): void {
        // Register built-in codebase visualizer
        const codebaseVisualizer = new CodebaseVisualizer();
        this.visualizers.set('codebase', codebaseVisualizer);

        console.log('Initialized built-in visualizers:', Array.from(this.visualizers.keys()));
    }

    public async loadCodebaseVisualizer(panel: vscode.WebviewPanel, targetPath: string): Promise<void> {
        const visualizer = this.visualizers.get('codebase');
        if (!visualizer) {
            throw new Error('Codebase visualizer not found');
        }

        try {
            this.cleanup();

            // Prepare metadata: pass down all info each file needs for default labels
            const cleanupFn = await visualizer.initialize(panel, { targetPath });

            this.activeCleanupFunctions.push(cleanupFn);

            console.log('Codebase visualizer loaded successfully');
        } catch (error) {
            console.error('Failed to load codebase visualizer:', error);
            throw error;
        }
    }

    public async discoverVisualizers(): Promise<void> {
        const extensionsPath = path.join(this.context.extensionPath, 'extensions');

        if (!fs.existsSync(extensionsPath)) {
            console.log('No extensions directory found, using built-in visualizers only');
            return;
        }

        try {
            const entries = fs.readdirSync(extensionsPath, { withFileTypes: true });

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    await this.loadVisualizerFromDirectory(path.join(extensionsPath, entry.name));
                }
            }
        } catch (error) {
            console.error('Error discovering visualizers:', error);
        }
    }

    private async loadVisualizerFromDirectory(dirPath: string): Promise<void> {
        const manifestPath = path.join(dirPath, 'manifest.json');

        if (!fs.existsSync(manifestPath)) {
            console.warn(`No manifest.json found in ${dirPath}`);
            return;
        }

        try {
            const manifestContent = fs.readFileSync(manifestPath, 'utf8');
            const manifest: VisualizerManifest = JSON.parse(manifestContent);

            console.log(`Discovered visualizer: ${manifest.name} (${manifest.type})`);
        } catch (error) {
            console.error(`Error loading visualizer from ${dirPath}:`, error);
        }
    }

    public getAvailableVisualizers(): VisualizerManifest[] {
        return Array.from(this.visualizers.values()).map(v => v.manifest);
    }

    public cleanup(): void {
        this.activeCleanupFunctions.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                console.error('Error during visualizer cleanup:', error);
            }
        });
        this.activeCleanupFunctions = [];
    }

    public dispose(): void {
        this.cleanup();
        this.visualizers.clear();
    }
}
