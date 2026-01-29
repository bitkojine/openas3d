// __mocks__/vscode.ts
declare var jest: any;

const sabotage = (name: string) => {
    return jest.fn().mockImplementation(() => {
        throw new Error(`Mock Sabotaged! vscode.${name} should not be called in a real test.`);
    });
};

export const workspace = {
    workspaceFolders: [{ uri: { fsPath: '/fake/workspace' } }],
    getWorkspaceFolder: sabotage('workspace.getWorkspaceFolder'),
    getConfiguration: sabotage('workspace.getConfiguration'),
    openTextDocument: sabotage('workspace.openTextDocument'),
    fs: {
        readFile: sabotage('workspace.fs.readFile'),
        stat: sabotage('workspace.fs.stat'),
        readdir: sabotage('workspace.fs.readdir'),
    },
};

export const window = {
    showInformationMessage: sabotage('window.showInformationMessage'),
    showWarningMessage: sabotage('window.showWarningMessage'),
    showErrorMessage: sabotage('window.showErrorMessage'),
    showQuickPick: sabotage('window.showQuickPick'),
    showInputBox: sabotage('window.showInputBox'),
    showTextDocument: sabotage('window.showTextDocument'),
};

export const commands = {
    registerCommand: sabotage('commands.registerCommand'),
};

export const extensions = {
    getExtension: sabotage('extensions.getExtension'),
};

export const Uri = {
    file: (s: string) => ({ fsPath: s }),
    parse: (s: string) => ({ fsPath: s }),
};
