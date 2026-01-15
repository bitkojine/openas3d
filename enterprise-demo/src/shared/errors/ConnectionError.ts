export class ConnectionError extends Error {
    public statusCode: number = 503;
    public code: string = 'CONNECTION_ERROR';

    constructor(message: string) {
        super(message);
        this.name = 'ConnectionError';
        Object.setPrototypeOf(this, ConnectionError.prototype);
    }
}