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

    constructor(controllerId: string = 'openas3dTests') {
        this.controller = vscode.tests.createTestController(controllerId, 'OpenAs3D Tests');
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

                // 1. Gather tests
                if (request.include) {
                    request.include.forEach(test => queue.push(test));
                } else {
                    this.controller.items.forEach(test => queue.push(test));
                }

                // 2. Determine Scope (are we running specific files?)
                // Simple strategy: If queue implies specific files, pass them as args
                const filesToRun = new Set<string>();
                queue.forEach(item => {
                    if (item.uri) {
                        filesToRun.add(vscode.workspace.asRelativePath(item.uri));
                    }
                });

                // Mark all as running
                queue.forEach(test => {
                    run.started(test);
                    this.updateInternalStatus(test, 'running');
                });

                // 3. Execute Jest
                // We use the workspace root for CWD
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (!workspaceRoot) {
                    run.end();
                    return;
                }

                try {
                    const spawn = require('cross-spawn');
                    const args = ['run', 'test', '--', '--json', '--testLocationInResults', '--passWithNoTests'];

                    // Add File Filters if not running full suite
                    if (filesToRun.size > 0 && filesToRun.size < 10) { // arbitrary limit to avoid huge command line
                        args.push(...Array.from(filesToRun));
                    }

                    const child = spawn('npm', args, { cwd: workspaceRoot });

                    let outputBuffer = '';
                    child.stdout.on('data', (data: any) => { outputBuffer += data.toString(); });
                    child.stderr.on('data', (data: any) => {
                        // Optional: log stderr to console 
                        const msg = data.toString();
                        console.log(`[Jest Stderr]: ${msg}`);
                        run.appendOutput(msg.replace(/\n/g, '\r\n'));
                    });

                    await new Promise<void>((resolve) => {
                        child.on('close', (code: number) => {
                            resolve();
                        });
                    });

                    // 4. Parse Results
                    // Jest JSON output might be mixed with other stdout if not careful, 
                    // but typically starts with { and ends with } if it's the only reporter.
                    // However, 'npm run' output might prepend. We look for first { and last }
                    const jsonStart = outputBuffer.indexOf('{');
                    const jsonEnd = outputBuffer.lastIndexOf('}');

                    if (jsonStart === -1 || jsonEnd === -1) {
                        throw new Error('Could not find JSON in Jest output');
                    }

                    const jsonStr = outputBuffer.substring(jsonStart, jsonEnd + 1);
                    const result = JSON.parse(jsonStr);

                    // 5. Map results back to TestItems
                    // Result structure: { testResults: [ { name: absolutePath, assertionResults: [ { title: string, status: passed/failed } ] } ] }

                    result.testResults.forEach((fileResult: any) => {
                        const relPath = vscode.workspace.asRelativePath(fileResult.name);

                        fileResult.assertionResults.forEach((assertion: any) => {
                            // Find the matching TestItem
                            // Our ID schema is "relPath:testName"
                            const testName = assertion.title;
                            const id = `${relPath}:${testName}`;

                            // We need to find this item in our map specifically to update status
                            const item = this.findTestItemById(id);

                            if (item) {
                                if (assertion.status === 'passed') {
                                    run.passed(item);
                                    this.updateInternalStatus(item, 'passed');
                                } else if (assertion.status === 'failed') {
                                    const message = new vscode.TestMessage(assertion.failureMessages.join('\n'));
                                    run.failed(item, message);
                                    this.updateInternalStatus(item, 'failed');
                                }
                            }
                        });
                    });

                } catch (err: any) {
                    console.error('Test run failed:', err);
                    run.appendOutput(`Error running tests: ${err.message}\r\n`);
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
        // Initial scan - batch updates
        const files = await vscode.workspace.findFiles('**/*.{test,spec}.{ts,js}', '**/node_modules/**');

        // Use a temporary flag to suppress events during bulk load
        let silent = true;
        const originalFire = this._onDidChangeTests.fire.bind(this._onDidChangeTests);
        this._onDidChangeTests.fire = () => { if (!silent) originalFire(); };

        try {
            for (const file of files) {
                await this.parseFile(file);
            }
        } finally {
            silent = false;
            this._onDidChangeTests.fire = originalFire;
            this._onDidChangeTests.fire(); // Single fire at the end
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

    private findTestItemById(id: string): vscode.TestItem | undefined {
        // ID format: fileId:testName
        // Structure: FileItem -> TestItems
        // So we can extract the fileId first
        const parts = id.split(':');
        const fileId = parts[0];

        const fileItem = this.controller.items.get(fileId);
        if (fileItem) {
            return fileItem.children.get(id);
        }
        return undefined;
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
