export class ValidationError extends Error {
    public readonly field?: string;
    public readonly code: string;

    constructor(message: string, field?: string, code: string = 'VALIDATION_ERROR') {
        super(message);
        this.name = 'ValidationError';
        this.field = field;
        this.code = code;
    }
}