import * as vscode from 'vscode';
import { Logger, LogLevel } from '../logger';

jest.mock('vscode', () => ({
    window: {
        createOutputChannel: jest.fn().mockReturnValue({
            appendLine: jest.fn(),
            show: jest.fn(),
            dispose: jest.fn()
        })
    }
}), { virtual: true });

describe('Logger', () => {
    let logger: Logger;
    let mockOutputChannel: any;

    beforeEach(() => {
        jest.clearAllMocks();
        Logger.resetInstance();
        logger = Logger.getInstance();
        mockOutputChannel = (vscode.window.createOutputChannel as jest.Mock).mock.results[0]?.value;
    });

    /**
     * Tests the singleton pattern implementation.
     * Verifies that multiple calls to getInstance() return the same object.
     */
    it('should be a singleton', () => {
        const instance1 = Logger.getInstance();
        const instance2 = Logger.getInstance();
        expect(instance1).toBe(instance2);
    });

    /**
     * Tests default logging behavior.
     * Verifies that INFO level messages are correctly written to the output channel.
     */
    it('should log info messages by default', () => {
        logger.info('Test Info message');
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test Info message'));
    });

    /**
     * Tests default log level filtering.
     * Verifies that DEBUG messages are suppressed by default (when level is INFO).
     */
    it('should not log debug messages by default', () => {
        logger.debug('Test Debug message');
        expect(mockOutputChannel.appendLine).not.toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Test Debug message'));
    });

    /**
     * Tests log level configuration.
     * Verifies that changing the log level to DEBUG enables debug output.
     */
    it('should log debug messages when log level is set to DEBUG', () => {
        logger.setLogLevel(LogLevel.DEBUG);
        logger.debug('Test Debug message');
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Test Debug message'));
        // Reset to INFO for other tests
        logger.setLogLevel(LogLevel.INFO);
    });

    /**
     * Tests WARNING level logging.
     */
    it('should log warn messages', () => {
        logger.warn('Test Warn message');
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[WARN] Test Warn message'));
    });

    /**
     * Tests ERROR level logging with object support.
     * Verifies that Error objects are logged with their stack traces for better debugging.
     */
    it('should log error messages with stack traces', () => {
        const error = new Error('Test Error');
        error.stack = 'Mock stack trace';
        logger.error('Test Error message', error);

        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Test Error message'));
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('Mock stack trace');
    });

    /**
     * Tests robust error logging.
     * Verifies that non-Error objects passed to the error method are still logged correctly.
     */
    it('should handle errors without stack traces', () => {
        logger.error('Test Error message', 'Simple error string');
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith('Simple error string');
    });

    /**
     * Tests logging of supplementary data.
     * Verifies that extra arguments passed to log methods are serialized to JSON
     * and included in the output.
     */
    it('should log additional arguments as JSON', () => {
        logger.info('Message with args', { key: 'value' }, [1, 2, 3]);
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[INFO] Message with args'));
        expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('"key": "value"'));
    });

    /**
     * Tests the visibility control for the output channel.
     */
    it('should show the output channel', () => {
        logger.show();
        expect(mockOutputChannel.show).toHaveBeenCalled();
    });

    /**
     * Tests cleanup of VS Code resources.
     */
    it('should dispose the output channel', () => {
        logger.dispose();
        expect(mockOutputChannel.dispose).toHaveBeenCalled();
    });
});
