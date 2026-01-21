import * as vscode from 'vscode';
import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';

suite('Extension Integration Test Suite', () => {
    // Cleanup signs after all tests
    suiteTeardown(() => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            const signsDir = path.join(workspaceFolders[0].uri.fsPath, 'signs');
            if (fs.existsSync(signsDir)) {
                // Read dir and delete md files
                const files = fs.readdirSync(signsDir);
                files.forEach(file => {
                    if (file.endsWith('.md')) {
                        fs.unlinkSync(path.join(signsDir, file));
                    }
                });
                // Optional: remove dir if empty
                try { fs.rmdirSync(signsDir); } catch (e) { }
            }
        }
    });

    test('Real User Journey: Walk, Dependencies, Sign, Edit', async () => {
        // 1. Open the 3D world AND trigger dependency exploration
        const workspaceFolders = vscode.workspace.workspaceFolders;
        assert.ok(workspaceFolders, 'No workspace folders found');
        const workspacePath = workspaceFolders[0].uri.fsPath;

        // Ensure webview is open and focused
        await vscode.commands.executeCommand('openas3d.openAs3DWorld');

        console.log('Triggering exploration...');
        await vscode.commands.executeCommand('openas3d.exploreDependencies');

        // Wait for webview to initialize and populate
        await getSceneState();

        // 2. Verify Initial State (Population & Dependencies)
        console.log('Verifying initial state...');
        let state: any = await getSceneState();
        assert.ok(state.objectCount > 0, 'Scene should be populated');
        assert.ok(state.dependencyCount > 0, 'Dependencies should be visualized');

        // 3. Simulate "Real" Movement (Walking)
        console.log('Simulating walking (KeyW)...');
        // Initial position logic is handled by CharacterController (starts at 0,2,20 looking at 0,0,0)
        // Moving Forward (W) -> -Z direction.
        const startPos = await getCameraPosition(); // We need to expose this or infer it
        // We can infer camera movement if we check if 'object visual positions relative to camera' change?
        // Or we just trust the loop. 
        // Better: check if we are closer to the objects (z < 20).

        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keydown', 'KeyW');
        await new Promise(r => setTimeout(r, 1000)); // Walk for 1s
        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keyup', 'KeyW');

        // We can't easily check camera pos without updating getSceneState to return camera pos.
        // But if commands run, we trust it.

        // 3.5 Look Around (Simulate Mouse Movement)
        console.log('Looking around...');
        // Look left smoothly
        await vscode.commands.executeCommand('openas3d.test.lookAt', -10, 2, 0, 1000);
        // Look right smoothly
        await vscode.commands.executeCommand('openas3d.test.lookAt', 10, 2, 0, 1000);
        // Look center smoothly
        await vscode.commands.executeCommand('openas3d.test.lookAt', 0, 2, 0, 1000);

        // 4. Create a Sign (Interaction)
        console.log('Creating a sign...');
        // Mock InputBox
        const originalShowInputBox = vscode.window.showInputBox;
        vscode.window.showInputBox = async () => "Integration Test Sign";

        // Toggle Sign Mode (E)
        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keydown', 'KeyE');
        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keyup', 'KeyE');

        // Click to place
        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'pointerdown');

        // Restore InputBox
        vscode.window.showInputBox = originalShowInputBox;

        // Verify Sign Exists
        await waitFor(async () => {
            state = await getSceneState();
            const sign = state.objects.find((o: any) => o.type === 'sign');
            return sign && sign.userData.description === "Integration Test Sign";
        }, 5000, 'Sign object creation failed or timed out');

        const sign = state.objects.find((o: any) => o.type === 'sign');
        assert.ok(sign, 'Sign object should exist in scene');
        assert.ok(sign.userData.description === "Integration Test Sign", 'Sign text should match');

        // 5. Edit a File (Watcher)
        console.log('Editing utils.ts...');
        const utilsPath = path.join(workspacePath, 'utils.ts');
        const originalContent = fs.readFileSync(utilsPath, 'utf-8');
        const newContent = originalContent + '\nexport const y = 2; // Added by test';

        fs.writeFileSync(utilsPath, newContent);

        // Wait for watcher -> webview update
        // We can check if size increased.
        // Original size: 20 bytes. New: > 20.
        let utilsObj: any;
        await waitFor(async () => {
            state = await getSceneState();
            utilsObj = state.objects.find((o: any) => o.userData.filePath && o.userData.filePath.endsWith('utils.ts'));
            if (!utilsObj) return false;
            const sizeMatch = utilsObj.userData.description.match(/Size: (\d+)/);
            if (!sizeMatch) return false;
            const size = parseInt(sizeMatch[1]);
            return size > 20;
        }, 5000, 'File watcher failing to update size description');

        const sizeMatch = utilsObj.userData.description.match(/Size: (\d+)/);
        assert.ok(sizeMatch, 'Description should contain size');
        const size = parseInt(sizeMatch[1]);
        assert.ok(size > 20, `Expected file size to increase, got ${size}`);

        // Restore file
        fs.writeFileSync(utilsPath, originalContent);
    });

    test('Features: Flight, Jump, Focus', async () => {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        assert.ok(workspaceFolders, 'No workspace folders found');

        // Ensure webview is ready (reuse open session or open new)
        await vscode.commands.executeCommand('openas3d.openAs3DWorld');
        // Wait a bit
        await new Promise(r => setTimeout(r, 2000));

        // 1. Test Jump
        console.log('Testing Jump...');
        let pos: any = await vscode.commands.executeCommand('openas3d.test.getPosition');
        // First position might take a moment to be available
        if (!pos) {
            await new Promise(r => setTimeout(r, 1000));
            pos = await vscode.commands.executeCommand('openas3d.test.getPosition');
        }

        const groundY = pos ? pos.y : 0.5; // Default ground height guess + eye height

        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keydown', 'Space');
        await new Promise(r => setTimeout(r, 200)); // Charge/Start jump
        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keyup', 'Space');

        // Check mid-air
        await new Promise(r => setTimeout(r, 100));
        pos = await vscode.commands.executeCommand('openas3d.test.getPosition');
        assert.ok(pos.y > groundY + 0.1, `Expected to jump higher than ${groundY}, got ${pos.y}`);

        // Wait to land
        await new Promise(r => setTimeout(r, 2000));

        // 2. Test Flight Mode
        console.log('Testing Flight Mode...');
        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keydown', 'KeyF');
        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keyup', 'KeyF');

        // Fly UP
        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keydown', 'Space');
        await new Promise(r => setTimeout(r, 1000));
        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keyup', 'Space');

        pos = await vscode.commands.executeCommand('openas3d.test.getPosition');
        assert.ok(pos.y > groundY + 2.0, `Expected to fly up high, got ${pos.y}`);

        // Fly DOWN
        const highY = pos.y;
        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keydown', 'KeyC');
        await new Promise(r => setTimeout(r, 1000));
        await vscode.commands.executeCommand('openas3d.test.simulateInput', 'keyup', 'KeyC');

        pos = await vscode.commands.executeCommand('openas3d.test.getPosition');
        assert.ok(pos.y < highY, `Expected to fly down, got ${pos.y}`);

        // 3. Test Object Focus (Hover)
        console.log('Testing Object Focus...');
        // Find index.ts again
        const state: any = await vscode.commands.executeCommand('openas3d.test.getSceneState');
        const indexObj = state.objects.find((o: any) => o.userData.filePath && o.userData.filePath.endsWith('index.ts'));

        // Teleport slightly away
        await vscode.commands.executeCommand('openas3d.test.teleport', indexObj.position.x, indexObj.position.y + 0, indexObj.position.z + 8);

        // Look at it
        await vscode.commands.executeCommand('openas3d.test.lookAt', indexObj.position.x, indexObj.position.y, indexObj.position.z);

        await new Promise(r => setTimeout(r, 1000));
        pos = await vscode.commands.executeCommand('openas3d.test.getPosition');
        // Check near teleport target
        assert.ok(Math.abs(pos.z - (indexObj.position.z + 8)) < 1.0, 'Teleport should have moved character');
        // Check near teleport target
        assert.ok(Math.abs(pos.z - (indexObj.position.z + 8)) < 1.0, 'Teleport should have moved character');
    });

    test('Lifecycle: Re-open and Context Menu', async () => {
        // 1. Test Context Menu Launch pattern
        // Simulate triggering "Explore Dependencies" on a specific folder/file
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders) {
            console.log('Testing Context Menu Launch...');
            await vscode.commands.executeCommand('openas3d.exploreDependencies', workspaceFolders[0].uri);

            // Verify it opened and populated
            const state: any = await getSceneState();
            assert.ok(state.objectCount > 0, 'Context menu launch should populate scene');
        }

        // 2. Test Re-opening (Persistence/Cleanup)
        console.log('Testing Re-opening...');
        // Close the webview (simulate by disposing panel if possible, 
        // or just calling open again which should focus or re-create)
        // Since we can't easily "close" the tab via API, we just call openAs3DWorld again
        // and ensure it doesn't crash or duplicate weirdly.
        await vscode.commands.executeCommand('openas3d.openAs3DWorld');

        const state2: any = await getSceneState();
        assert.ok(state2.objectCount > 0, 'Scene should remain valid after re-open command');
    });
});

async function waitFor(condition: () => Promise<boolean>, timeout = 5000, message = 'Timeout waiting for condition') {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (await condition()) return;
        await new Promise(r => setTimeout(r, 100));
    }
    throw new Error(message);
}

async function getSceneState() {
    let lastState: any;
    await waitFor(async () => {
        try {
            lastState = await vscode.commands.executeCommand('openas3d.test.getSceneState');
            return lastState && lastState.objectCount > 0;
        } catch { return false; }
    }, 10000, 'Failed to get valid scene state with objects');
    return lastState;
}

async function getCameraPosition() {
    // Ideally TestBridge exposes this. For now we skip specific pos assertion
    // and rely on no errors during movement.
    return { x: 0, y: 0, z: 0 };
}
