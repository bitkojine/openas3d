import { ExtensionLogger, LogLevel } from '../logger';
import * as vscode from 'vscode';

jest.mock('vscode', () => ({
    window: {
        createOutputChannel: jest.fn().mockReturnValue({
            appendLine: jest.fn()
        })
    }
}));

describe('ExtensionLogger', () => {
    let mockOutputChannel: any;
    let logger: ExtensionLogger;

    beforeEach(() => {
        jest.clearAllMocks();
        logger = new ExtensionLogger('Test');
        mockOutputChannel = (vscode.window.createOutputChannel as jest.Mock).mock.results[0].value;
    });

    it('respects log levels (INFO default)', () => {
        logger.debug('debug pulse');
        logger.info('info pulse');

        expect(mockOutputChannel.appendLine).toHaveBeenCalledTimes(1);
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[INFO]: info pulse'));
    });

    it('respects DEBUG level', () => {
        logger.setLevel(LogLevel.DEBUG);
        logger.debug('debug pulse');

        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]: debug pulse'));
    });

    it('respects NONE level', () => {
        logger.setLevel(LogLevel.NONE);
        logger.error('error pulse');

        expect(mockOutputChannel.appendLine).not.toHaveBeenCalled();
    });

    it('logs performance warnings when above threshold', () => {
        logger.performance('slowTask', 200, 100);
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[WARN]: Performance Warning: slowTask took 200.00ms'));
    });

    it('logs performance debug when below threshold and level is DEBUG', () => {
        logger.setLevel(LogLevel.DEBUG);
        logger.performance('fastTask', 50, 100);
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[DEBUG]: Performance: fastTask took 50.00ms'));
    });

    it('creates child loggers with context', () => {
        const child = logger.createChild('ChildA');
        child.info('hello');

        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('{"_ctx":"ChildA"}'));
    });

    it('creates nested child loggers', () => {
        const child = logger.createChild('Parent').createChild('Child');
        child.info('nested');

        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('{"_ctx":"Parent:Child"}'));
    });
});
