export class ValidationError extends Error {
    public statusCode: number = 400;
    public code: string = 'VALIDATION_ERROR';

    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
        Object.setPrototypeOf(this, ValidationError.prototype);
    }
}