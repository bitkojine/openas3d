export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

export interface WebviewLogEntry {
    level: LogLevel;
    message: string;
    context?: any;
    timestamp: number;
}

export interface Logger {
    debug(message: string, context?: any): void;
    info(message: string, context?: any): void;
    warn(message: string, context?: any): void;
    error(message: string, error?: any, context?: any): void;
}

export class WebviewLogger implements Logger {
    private batchSize: number = 10;
    private batchDelay: number = 1000;
    private buffer: WebviewLogEntry[] = [];
    private timer: any = null;
    private level: LogLevel = LogLevel.INFO;

    constructor(private vscode: any, options?: { batchSize?: number, batchDelay?: number }) {
        if (options?.batchSize) this.batchSize = options.batchSize;
        if (options?.batchDelay) this.batchDelay = options.batchDelay;
    }

    public setLevel(level: LogLevel): void {
        this.level = level;
    }

    public debug(message: string, context?: any): void {
        if (this.level <= LogLevel.DEBUG) {
            this.log(LogLevel.DEBUG, message, context);
        }
    }

    public info(message: string, context?: any): void {
        if (this.level <= LogLevel.INFO) {
            this.log(LogLevel.INFO, message, context);
        }
    }

    public warn(message: string, context?: any): void {
        if (this.level <= LogLevel.WARN) {
            this.log(LogLevel.WARN, message, context);
        }
    }

    public error(message: string, error?: any, context?: any): void {
        if (this.level <= LogLevel.ERROR) {
            const errorMsg = error instanceof Error ? error.stack || error.message : JSON.stringify(error);
            const combinedContext = { ...context, error: errorMsg };
            // Errors bypass batching
            this.vscode.postMessage({
                type: 'log',
                data: {
                    level: LogLevel.ERROR,
                    message,
                    context: combinedContext
                }
            });
        }
    }

    private log(level: LogLevel, message: string, context?: any): void {
        this.buffer.push({
            level,
            message,
            context,
            timestamp: Date.now()
        });

        if (this.buffer.length >= this.batchSize) {
            this.flush();
        } else if (!this.timer) {
            this.timer = setTimeout(() => this.flush(), this.batchDelay);
        }
    }

    private flush(): void {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        if (this.buffer.length === 0) return;

        const logs = [...this.buffer];
        this.buffer = [];

        this.vscode.postMessage({
            type: 'logBatch',
            data: { logs }
        });
    }
}
