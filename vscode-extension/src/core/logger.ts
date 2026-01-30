/**
 * Logger - Centralized logging for OpenAs3D extension
 */

import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

export class Logger implements vscode.Disposable {
    private static instance: Logger;
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = LogLevel.INFO;

    private constructor() {
        this.outputChannel = vscode.window.createOutputChannel('OpenAs3D');
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    /**
     * Resets the singleton instance (primarily for testing purposes)
     */
    public static resetInstance(): void {
        if (Logger.instance) {
            Logger.instance.dispose();
            Logger.instance = undefined as any;
        }
    }

    public setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    public debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    public info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    public warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    public error(message: string, error?: any, ...args: any[]): void {
        this.log(LogLevel.ERROR, message, ...args);
        if (error) {
            this.outputChannel.appendLine(error.stack || error.message || String(error));
        }
    }

    private log(level: LogLevel, message: string, ...args: any[]): void {
        if (level < this.logLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const levelStr = LogLevel[level];
        const formattedMessage = `[${timestamp}] [${levelStr}] ${message}`;

        this.outputChannel.appendLine(formattedMessage);

        if (args.length > 0) {
            this.outputChannel.appendLine(JSON.stringify(args, null, 2));
        }

        // Also log to console for development
        if (process.env.NODE_ENV === 'development') {
            switch (level) {
                case LogLevel.DEBUG: console.debug(formattedMessage, ...args); break;
                case LogLevel.INFO: console.info(formattedMessage, ...args); break;
                case LogLevel.WARN: console.warn(formattedMessage, ...args); break;
                case LogLevel.ERROR: console.error(formattedMessage, ...args); break;
            }
        }
    }

    public show(): void {
        this.outputChannel.show();
    }

    public dispose(): void {
        this.outputChannel.dispose();
    }
}
