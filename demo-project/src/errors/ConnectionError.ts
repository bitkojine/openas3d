export class ConnectionError extends Error {
    public readonly code: string;
    public readonly retryable: boolean;

    constructor(message: string, code: string = 'CONNECTION_ERROR', retryable: boolean = true) {
        super(message);
        this.name = 'ConnectionError';
        this.code = code;
        this.retryable = retryable;
    }
}