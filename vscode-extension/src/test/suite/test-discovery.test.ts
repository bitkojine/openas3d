import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { TestDiscoveryService } from '../../services/test-discovery-service';

suite('TestDiscoveryService Test Suite', () => {
    let workspaceRoot: string;
    let service: TestDiscoveryService;

    suiteSetup(async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            throw new Error('No workspace folders found');
        }
        workspaceRoot = workspaceFolders[0].uri.fsPath;
    });

    setup(() => {
        service = new TestDiscoveryService(`test-discovery-${Math.random()}`);
    });

    teardown(() => {
        service.dispose();
    });

    test('Should discover tests in a .test.ts file', async () => {
        const testFileContent = `
            describe('My Component', () => {
                it('should do something', () => {});
                test("should also do this", () => {});
            });
        `;
        const testFilePath = path.join(workspaceRoot, 'discovery-test.test.ts');
        fs.writeFileSync(testFilePath, testFileContent);

        try {
            // Wait for discovery - since it uses findFiles on init, we might need a delay
            // or we manually call parseFile for the test
            const uri = vscode.Uri.file(testFilePath);

            // Wait for service to fire event
            await new Promise<void>((resolve) => {
                const disposable = service.onDidChangeTests(() => {
                    const tests = service.getTests().get('discovery-test.test.ts');
                    if (tests && tests.length === 2) {
                        disposable.dispose();
                        resolve();
                    }
                });

                // Trigger parse manually to speed up test or if it missed the watcher
                (service as any).parseFile(uri);
            });

            const tests = service.getTests().get('discovery-test.test.ts');
            assert.ok(tests, 'Test file should be discovered');
            assert.strictEqual(tests?.length, 2, 'Should find 2 tests');
            assert.strictEqual(tests?.[0].label, 'should do something');
            assert.strictEqual(tests?.[1].label, 'should also do this');

        } finally {
            if (fs.existsSync(testFilePath)) {
                fs.unlinkSync(testFilePath);
            }
        }
    });

    test('Should handle file deletion', async () => {
        const testFilePath = path.join(workspaceRoot, 'delete-me.test.ts');
        fs.writeFileSync(testFilePath, 'it("test", () => {});');
        const uri = vscode.Uri.file(testFilePath);

        // First parse it
        await (service as any).parseFile(uri);
        assert.ok(service.getTests().has('delete-me.test.ts'));

        // Delete it
        fs.unlinkSync(testFilePath);

        // Mock removeFile call or wait for watcher (watcher is async and environment dependent)
        (service as any).removeFile(uri);

        assert.strictEqual(service.getTests().has('delete-me.test.ts'), false, 'Test file should be removed from discovery');
    });
});
