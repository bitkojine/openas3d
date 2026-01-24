import * as vscode from 'vscode';
import * as path from 'path';

export interface TestItem {
    id: string; // usually "fileId:Test Name"
    fileId: string;
    label: string; // The test name e.g. "should allow dragging"
    line: number;
    status: 'unknown' | 'passed' | 'failed' | 'running';
}

export class TestDiscoveryService {
    private tests: Map<string, TestItem[]> = new Map(); // fileId -> tests
    private controller: vscode.TestController;
    private _onDidChangeTests = new vscode.EventEmitter<void>();
    public readonly onDidChangeTests = this._onDidChangeTests.event;

    constructor() {
        this.controller = vscode.tests.createTestController('openas3dTests', 'OpenAs3D Tests');
        this.initialize();
        this.setupRunProfile();
    }

    private setupRunProfile() {
        this.controller.createRunProfile(
            'Run All',
            vscode.TestRunProfileKind.Run,
            async (request, token) => {
                const run = this.controller.createTestRun(request);
                const queue: vscode.TestItem[] = [];

                if (request.include) {
                    request.include.forEach(test => queue.push(test));
                } else {
                    this.controller.items.forEach(test => queue.push(test));
                }

                while (queue.length > 0 && !token.isCancellationRequested) {
                    const test = queue.pop()!;

                    // If it has children, add them to queue
                    test.children.forEach(child => queue.push(child));

                    run.started(test);
                    this.updateInternalStatus(test, 'running');

                    // Simulate run
                    await new Promise(r => setTimeout(r, 50));

                    if (test.label.toLowerCase().includes('fail')) {
                        run.failed(test, new vscode.TestMessage('Deliberate failure'));
                        this.updateInternalStatus(test, 'failed');
                    } else {
                        run.passed(test);
                        this.updateInternalStatus(test, 'passed');
                    }
                }

                run.end();
            },
            true
        );

        this.controller.resolveHandler = async (item) => {
            if (!item) {
                await this.initialize();
            } else {
                // If it's a file, we could re-parse it here if needed
                if (item.uri) await this.parseFile(item.uri);
            }
        };
    }

    private updateInternalStatus(testItem: vscode.TestItem, status: 'passed' | 'failed' | 'running') {
        const fileId = testItem.uri ? vscode.workspace.asRelativePath(testItem.uri) : null;
        if (!fileId) return;

        const tests = this.tests.get(fileId);
        if (tests) {
            const test = tests.find(t => t.id === testItem.id);
            if (test) {
                test.status = status;
                this._onDidChangeTests.fire();
            }
        }
    }

    private async initialize() {
        // Initial scan
        const files = await vscode.workspace.findFiles('**/*.{test,spec}.{ts,js}', '**/node_modules/**');
        for (const file of files) {
            await this.parseFile(file);
        }

        // Watch for changes
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.{test,spec}.{ts,js}');
        watcher.onDidChange(uri => this.parseFile(uri));
        watcher.onDidCreate(uri => this.parseFile(uri));
        watcher.onDidDelete(uri => this.removeFile(uri));
    }

    public getTests(): Map<string, TestItem[]> {
        return this.tests;
    }

    private async parseFile(uri: vscode.Uri) {
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            const text = document.getText();
            const fileId = vscode.workspace.asRelativePath(uri);

            const foundTests: TestItem[] = [];

            // Create or get file level test item
            let fileTestItem = this.controller.items.get(fileId);
            if (!fileTestItem) {
                fileTestItem = this.controller.createTestItem(fileId, fileId, uri);
                this.controller.items.add(fileTestItem);
            }

            // Clear existing children for fresh parse
            fileTestItem.children.replace([]);

            const regex = /(?:it|test)\s*\(\s*(['"`])(.*?)\1/g;

            let match;
            while ((match = regex.exec(text)) !== null) {
                const testName = match[2];
                const position = document.positionAt(match.index);
                const line = position.line;

                foundTests.push({
                    id: `${fileId}:${testName}`,
                    fileId: fileId,
                    label: testName,
                    line: line,
                    status: 'unknown'
                });

                // Add to VSCode Test Controller
                const childTestItem = this.controller.createTestItem(`${fileId}:${testName}`, testName, uri);
                childTestItem.range = new vscode.Range(position, position);
                fileTestItem.children.add(childTestItem);
            }

            this.tests.set(fileId, foundTests);
            this._onDidChangeTests.fire();

        } catch (e) {
            console.error(`Failed to parse test file ${uri.fsPath}`, e);
        }
    }

    private removeFile(uri: vscode.Uri) {
        const fileId = vscode.workspace.asRelativePath(uri);
        this.controller.items.delete(fileId);
        if (this.tests.delete(fileId)) {
            this._onDidChangeTests.fire();
        }
    }

    public dispose() {
        this.controller.dispose();
    }
}
