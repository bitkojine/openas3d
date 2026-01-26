import * as path from 'path';
import Mocha = require('mocha');
const { glob } = require('glob');

export function run(): Promise<void> {
    // Create the mocha test
    const mocha = new Mocha({
        ui: 'tdd',
        color: true,
        timeout: 60000 // Higher timeout for integration tests
    });

    mocha.suite.on('test', (t: any) => {
        console.log(`[E2E] RUN ${t.fullTitle()}`);
        try {
            const vscode = require('vscode');
            void vscode.commands.executeCommand('openas3d.test.e2eStatus', {
                phase: 'run',
                title: t.fullTitle()
            });
        } catch {
            // ignore (not running in VS Code test host)
        }
    });

    mocha.suite.on('pass', (t: any) => {
        console.log(`[E2E] PASS ${t.fullTitle()}`);
        try {
            const vscode = require('vscode');
            void vscode.commands.executeCommand('openas3d.test.e2eStatus', {
                phase: 'pass',
                title: t.fullTitle()
            });
        } catch {
            // ignore
        }
    });

    mocha.suite.on('fail', (t: any, err: any) => {
        console.log(`[E2E] FAIL ${t.fullTitle()} - ${err?.message || err}`);
        try {
            const vscode = require('vscode');
            void vscode.commands.executeCommand('openas3d.test.e2eStatus', {
                phase: 'fail',
                title: t.fullTitle(),
                message: err?.message || String(err)
            });
        } catch {
            // ignore
        }
    });

    const testsRoot = path.resolve(__dirname);

    return new Promise(async (resolve, reject) => {
        try {
            // Glob v10+ returns a Promise
            const files = await glob('**/**.test.js', { cwd: testsRoot });

            // Add files to the test suite
            files.forEach((f: string) => mocha.addFile(path.resolve(testsRoot, f)));

            // Run the mocha test
            mocha.run(failures => {
                if (failures > 0) {
                    reject(new Error(`${failures} tests failed.`));
                } else {
                    resolve();
                }
            });
        } catch (err) {
            console.error(err);
            reject(err);
        }
    });
}
