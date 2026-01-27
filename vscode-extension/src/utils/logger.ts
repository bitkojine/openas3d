import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

export interface Logger {
    debug(message: string, context?: any): void;
    info(message: string, context?: any): void;
    warn(message: string, context?: any): void;
    error(message: string, error?: Error | any, context?: any): void;
    performance(label: string, durationMs: number, thresholdMs?: number): void;
    setLevel(level: LogLevel): void;
    createChild(context: string): Logger;
}

export class ExtensionLogger implements Logger {
    private level: LogLevel = LogLevel.INFO;
    private outputChannel: vscode.OutputChannel;
    private context?: string;

    constructor(name: string, context?: string) {
        this.outputChannel = vscode.window.createOutputChannel(name);
        this.context = context;
    }

    public setLevel(level: LogLevel): void {
        this.level = level;
    }

    private formatMessage(level: string, message: string, context?: any): string {
        const timestamp = new Date().toISOString();
        const ctxStr = this.context ? ` [${this.context}]` : '';
        const extraCtx = context ? ` ${JSON.stringify(context)}` : '';
        return `[${timestamp}] [${level}]${ctxStr}: ${message}${extraCtx}`;
    }

    public debug(message: string, context?: any): void {
        if (this.level <= LogLevel.DEBUG) {
            this.outputChannel.appendLine(this.formatMessage('DEBUG', message, context));
        }
    }

    public info(message: string, context?: any): void {
        if (this.level <= LogLevel.INFO) {
            this.outputChannel.appendLine(this.formatMessage('INFO', message, context));
        }
    }

    public warn(message: string, context?: any): void {
        if (this.level <= LogLevel.WARN) {
            this.outputChannel.appendLine(this.formatMessage('WARN', message, context));
        }
    }

    public error(message: string, error?: Error | any, context?: any): void {
        if (this.level <= LogLevel.ERROR) {
            const errorMsg = error instanceof Error ? error.stack || error.message : JSON.stringify(error);
            const combinedContext = { ...context, error: errorMsg };
            this.outputChannel.appendLine(this.formatMessage('ERROR', message, combinedContext));
        }
    }

    public performance(label: string, durationMs: number, thresholdMs: number = 100): void {
        if (durationMs >= thresholdMs) {
            this.warn(`Performance Warning: ${label} took ${durationMs.toFixed(2)}ms`, { thresholdMs });
        } else if (this.level <= LogLevel.DEBUG) {
            this.debug(`Performance: ${label} took ${durationMs.toFixed(2)}ms`);
        }
    }

    public createChild(context: string): Logger {
        const child = new ChildLogger(this, context);
        child.setLevel(this.level);
        return child;
    }

    // Special method for regular classes to access the output channel if needed
    public appendLine(message: string): void {
        this.outputChannel.appendLine(message);
    }
}

class ChildLogger implements Logger {
    private level: LogLevel = LogLevel.INFO;
    private parent: ExtensionLogger;
    private context: string;

    constructor(parent: ExtensionLogger, context: string) {
        this.parent = parent;
        this.context = context;
    }

    public setLevel(level: LogLevel): void {
        this.level = level;
    }

    private getFullContext(extraContext?: any): any {
        return extraContext ? { _ctx: this.context, ...extraContext } : { _ctx: this.context };
    }

    public debug(message: string, context?: any): void {
        if (this.level <= LogLevel.DEBUG) {
            this.parent.debug(message, this.getFullContext(context));
        }
    }

    public info(message: string, context?: any): void {
        if (this.level <= LogLevel.INFO) {
            this.parent.info(message, this.getFullContext(context));
        }
    }

    public warn(message: string, context?: any): void {
        if (this.level <= LogLevel.WARN) {
            this.parent.warn(message, this.getFullContext(context));
        }
    }

    public error(message: string, error?: Error | any, context?: any): void {
        if (this.level <= LogLevel.ERROR) {
            this.parent.error(message, error, this.getFullContext(context));
        }
    }

    public performance(label: string, durationMs: number, thresholdMs?: number): void {
        this.parent.performance(`${this.context}:${label}`, durationMs, thresholdMs);
    }

    public createChild(context: string): Logger {
        return new ChildLogger(this.parent, `${this.context}:${context}`);
    }
}

// Singleton instances
let logger: ExtensionLogger;

export function getLogger(): Logger {
    if (!logger) {
        logger = new ExtensionLogger('OpenAs3D');
    }
    return logger;
}
