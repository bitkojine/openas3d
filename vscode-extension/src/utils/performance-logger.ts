import { Logger } from './logger';

export class PerformanceLogger {
    private thresholdMs: number = 100;

    constructor(private logger: Logger) { }

    public setThreshold(thresholdMs: number): void {
        this.thresholdMs = thresholdMs;
    }

    public measure(label: string, startTime: number): void {
        const duration = performance.now() - startTime;
        this.logger.performance(label, duration, this.thresholdMs);
    }

    public run<T>(label: string, operation: () => T, thresholdMs?: number): T {
        const start = performance.now();
        try {
            return operation();
        } finally {
            this.logger.performance(label, performance.now() - start, thresholdMs ?? this.thresholdMs);
        }
    }

    public async runAsync<T>(label: string, operation: () => Promise<T>, thresholdMs?: number): Promise<T> {
        const start = performance.now();
        try {
            return await operation();
        } finally {
            this.logger.performance(label, performance.now() - start, thresholdMs ?? this.thresholdMs);
        }
    }
}
