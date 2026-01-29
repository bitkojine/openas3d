import { DescriptionSyncService, FileSystemProxy } from '../description-sync-service';
import { ExtensionMessage } from '../../shared/messages';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

class FakeWatcher implements vscode.FileSystemWatcher {
    public onCreateHandlers: ((uri: vscode.Uri) => any)[] = [];
    public onChangeHandlers: ((uri: vscode.Uri) => any)[] = [];
    public onDeleteHandlers: ((uri: vscode.Uri) => any)[] = [];

    onDidCreate = (h: (uri: vscode.Uri) => any) => { this.onCreateHandlers.push(h); return { dispose: () => { } }; };
    onDidChange = (h: (uri: vscode.Uri) => any) => { this.onChangeHandlers.push(h); return { dispose: () => { } }; };
    onDidDelete = (h: (uri: vscode.Uri) => any) => { this.onDeleteHandlers.push(h); return { dispose: () => { } }; };

    ignoreCreateEvents = false; ignoreChangeEvents = false; ignoreDeleteEvents = false;
    dispose = () => { };
}

class FakeFileSystem implements FileSystemProxy {
    public watcher = new FakeWatcher();
    public workspaceFolders: vscode.WorkspaceFolder[];

    constructor(rootPath: string) {
        this.workspaceFolders = [{ uri: vscode.Uri.file(rootPath), name: 'test', index: 0 }];
    }

    createFileSystemWatcher() { return this.watcher; }

    async openTextDocument(uri: vscode.Uri) {
        const content = fs.readFileSync(uri.fsPath, 'utf8');
        return { getText: () => content };
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        const stats = fs.statSync(uri.fsPath);
        return {
            type: stats.isDirectory() ? vscode.FileType.Directory : vscode.FileType.File,
            ctime: stats.ctimeMs,
            mtime: stats.mtimeMs,
            size: stats.size
        };
    }
}

describe('DescriptionSyncService (Behavioral)', () => {
    let service: DescriptionSyncService;
    let fakeFS: FakeFileSystem;
    let tempDir: string;
    let sentMessages: ExtensionMessage[] = [];

    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'desc-sync-test-'));
        sentMessages = [];
        fakeFS = new FakeFileSystem(tempDir);
        service = new DescriptionSyncService(
            (msg) => sentMessages.push(msg),
            fakeFS
        );
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it('should extract summary and status from MD file', async () => {
        const mdPath = path.join(tempDir, 'service.ts.md');
        const content = `
# Description
## Summary
This is a test service that handles logic.
## More details
status: reconciled
`;
        fs.writeFileSync(mdPath, content);

        await service.handleFileChange(vscode.Uri.file(mdPath));

        expect(sentMessages.length).toBe(1);
        const msg = sentMessages[0];
        if (msg.type === 'updateObjectDescription') {
            expect(msg.data.description.summary).toBe('This is a test service that handles logic.');
            expect(msg.data.description.status).toBe('reconciled');
        } else {
            fail('Expected updateObjectDescription message');
        }
    });

    it('should generate summary from code file when MD is missing or empty', async () => {
        const tsPath = path.join(tempDir, 'utils.ts');
        fs.writeFileSync(tsPath, 'export const a = 1;');

        // Wait a bit to ensure mtime is set
        await new Promise(resolve => setTimeout(resolve, 10));

        await service.handleFileChange(vscode.Uri.file(tsPath));

        expect(sentMessages.length).toBe(1);
        const msg = sentMessages[0];
        if (msg.type === 'updateObjectDescription') {
            expect(msg.data.description.summary).toContain('Language: TypeScript');
            expect(msg.data.description.summary).toContain('Filename: utils.ts');
            expect(msg.data.description.status).toBe('generated');
        } else {
            fail('Expected updateObjectDescription message');
        }
    });

    it('should handle file deletion by sending missing status', () => {
        const filePath = path.join(tempDir, 'deleted.ts');

        service.handleFileDelete(vscode.Uri.file(filePath));

        expect(sentMessages.length).toBe(1);
        const msg = sentMessages[0];
        if (msg.type === 'updateObjectDescription') {
            expect(msg.data.description.status).toBe('missing');
            expect(msg.data.filePath).toBe(vscode.Uri.file(filePath).fsPath);
        } else {
            fail('Expected updateObjectDescription message');
        }
    });

    it('should fall back to default text when extraction fails completely', async () => {
        const nonExistentPath = path.join(tempDir, 'ghost.ts');

        await service.handleFileChange(vscode.Uri.file(nonExistentPath));

        expect(sentMessages.length).toBe(1);
        const msg = sentMessages[0];
        if (msg.type === 'updateObjectDescription') {
            expect(msg.data.description.summary).toBe('No description available');
        } else {
            fail('Expected updateObjectDescription message');
        }
    });
});

