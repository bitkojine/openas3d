import { Logger, LogLevel } from './logger';

export interface WebviewLogBatch {
    logs: {
        level: LogLevel;
        message: string;
        context?: any;
    }[];
}

export class ExtensionWebviewLogger {
    constructor(private logger: Logger) { }

    public handleBatch(batch: WebviewLogBatch): void {
        for (const log of batch.logs) {
            switch (log.level) {
                case LogLevel.DEBUG:
                    this.logger.debug(log.message, log.context);
                    break;
                case LogLevel.INFO:
                    this.logger.info(log.message, log.context);
                    break;
                case LogLevel.WARN:
                    this.logger.warn(log.message, log.context);
                    break;
                case LogLevel.ERROR:
                    this.logger.error(log.message, log.context);
                    break;
            }
        }
    }

    public handleSingleLog(level: LogLevel, message: string, context?: any): void {
        switch (level) {
            case LogLevel.DEBUG:
                this.logger.debug(message, context);
                break;
            case LogLevel.INFO:
                this.logger.info(message, context);
                break;
            case LogLevel.WARN:
                this.logger.warn(message, context);
                break;
            case LogLevel.ERROR:
                this.logger.error(message, context);
                break;
        }
    }
}
