// __mocks__/vscode.ts
export const workspace = {
    workspaceFolders: [{ uri: { fsPath: '/fake/workspace' } }],
    getWorkspaceFolder: jest.fn(),
    getConfiguration: jest.fn(),
    openTextDocument: jest.fn(async (uri: any) => ({ uri, getText: () => 'mock content' })),
    fs: {
        readFile: jest.fn(async (uri: any) => Buffer.from('mock content')),
        stat: jest.fn(async (uri: any) => ({ size: 100, mtime: new Date(), type: 0 })),
        readdir: jest.fn(async (uri: any) => []),
    },
};

export const window = {
    showInformationMessage: jest.fn(),
    showWarningMessage: jest.fn(),
    showErrorMessage: jest.fn(),
    showQuickPick: jest.fn(),
    showInputBox: jest.fn(),
    showTextDocument: jest.fn(async (doc: any) => doc),
};

export const commands = {
    registerCommand: jest.fn(),
};

export const extensions = {
    getExtension: jest.fn().mockReturnValue({ packageJSON: { version: '0.0.0' } }),
};

export const Uri = {
    file: (s: string) => ({ fsPath: s }),
    parse: (s: string) => ({ fsPath: s }),
};
