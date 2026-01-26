import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main() {
    try {
        // The folder containing the Extension Manifest package.json
        // Passed to `--extensionDevelopmentPath`
        const extensionDevelopmentPath = path.resolve(__dirname, '../../');

        // The path to test runner
        // Passed to --extensionTestsPath
        const extensionTestsPath = path.resolve(__dirname, './suite/index');

        // Use isolated dirs so integration tests can run while another VS Code instance is open.
        const testUserDataDir = path.resolve(__dirname, '../../.vscode-test-user-data');
        const testExtensionsDir = path.resolve(__dirname, '../../.vscode-test-extensions');

        // Download VS Code, unzip it and run the integration test
        await runTests({
            extensionDevelopmentPath,
            extensionTestsPath,
            launchArgs: [
                // Use the project root as workspace for testing
                extensionDevelopmentPath,
                '--user-data-dir',
                testUserDataDir,
                '--extensions-dir',
                testExtensionsDir
            ]
        });
    } catch (err) {
        console.error('Failed to run tests');
        process.exit(1);
    }
}

main();
