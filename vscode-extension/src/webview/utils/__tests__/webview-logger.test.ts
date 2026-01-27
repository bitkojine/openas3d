import { WebviewLogger, LogLevel } from '../webview-logger';

describe('WebviewLogger', () => {
    let mockVsCode: any;
    let logger: WebviewLogger;

    beforeEach(() => {
        jest.useFakeTimers();
        mockVsCode = {
            postMessage: jest.fn()
        };
        logger = new WebviewLogger(mockVsCode, { batchSize: 5, batchDelay: 1000 });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('batches regular logs', () => {
        logger.info('msg 1');
        logger.info('msg 2');

        expect(mockVsCode.postMessage).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1000);

        expect(mockVsCode.postMessage).toHaveBeenCalledWith({
            type: 'logBatch',
            data: {
                logs: expect.arrayContaining([
                    expect.objectContaining({ message: 'msg 1' }),
                    expect.objectContaining({ message: 'msg 2' })
                ])
            }
        });
    });

    it('flushes when batch size is reached', () => {
        for (let i = 0; i < 5; i++) {
            logger.info(`msg ${i}`);
        }

        expect(mockVsCode.postMessage).toHaveBeenCalledTimes(1);
        expect(mockVsCode.postMessage).toHaveBeenCalledWith({
            type: 'logBatch',
            data: {
                logs: expect.arrayContaining([
                    expect.objectContaining({ message: 'msg 0' }),
                    expect.objectContaining({ message: 'msg 4' })
                ])
            }
        });
    });

    it('errors bypass batching', () => {
        logger.error('critical failure');

        expect(mockVsCode.postMessage).toHaveBeenCalledWith({
            type: 'log',
            data: expect.objectContaining({
                level: LogLevel.ERROR,
                message: 'critical failure'
            })
        });
    });

    it('respects log level', () => {
        logger.setLevel(LogLevel.WARN);
        logger.info('should not log');

        jest.advanceTimersByTime(1000);
        expect(mockVsCode.postMessage).not.toHaveBeenCalled();

        logger.warn('should log');
        jest.advanceTimersByTime(1000);
        expect(mockVsCode.postMessage).toHaveBeenCalled();
    });
});
