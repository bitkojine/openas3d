export const workspace = {
    workspaceFolders: [{ uri: { fsPath: '/fake/workspace' } }],
    getWorkspaceFolder: jest.fn(),
    getConfiguration: jest.fn()
};

export const window = {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn()
};

export const commands = {
    registerCommand: jest.fn()
};

export const extensions = {
    getExtension: jest.fn().mockReturnValue({ packageJSON: { version: '0.0.0' } })
};

export const Uri = {
    file: (s: string) => ({ fsPath: s }),
    parse: (s: string) => ({ fsPath: s })
};
