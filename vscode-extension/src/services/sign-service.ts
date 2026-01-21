// services/sign-service.ts
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WebviewPanelManager } from '../webview/panel';

export class SignService {
    constructor(private panelManager: WebviewPanelManager) {}

    /**
     * Add a sign at the given 3D position.
     * Handles user input, file creation, and webview messaging.
     */
    public async addSignAtPosition(position: { x: number; y: number; z: number }) {
        if (!vscode.workspace.workspaceFolders?.length) {return;}

        const workspaceFolder = vscode.workspace.workspaceFolders[0];

        // Prompt the user for sign text
        const text = await vscode.window.showInputBox({
            prompt: 'Enter sign text (short message)'
        });
        if (!text) {return;}

        // Ensure the "signs" folder exists
        const signsDir = path.join(workspaceFolder.uri.fsPath, 'signs');
        fs.mkdirSync(signsDir, { recursive: true });

        // Generate a timestamped filename
        const timestamp = Date.now();
        const fileName = `sign-${timestamp}.md`;
        const filePath = path.join(signsDir, fileName);

        // Compose the Markdown content
        const content = `---
status: missing
lastUpdated: ${new Date().toISOString()}
---

# ${text}
## Summary
${text}
`;

        // Write the file
        fs.writeFileSync(filePath, content, { encoding: 'utf-8' });

        // Notify the webview to render the sign object
        this.panelManager.sendMessage({
            type: 'addObject',
            data: {
                id: `sign-${timestamp}`,
                type: 'sign',
                filePath,
                position,
                description: text,
                color: 0xFFDD00
            }
        });
    }
}
