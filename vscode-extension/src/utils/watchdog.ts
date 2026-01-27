import { getLogger, Logger } from './logger';

let _logger: Logger | null = null;
function getWatchdogLogger() {
    if (!_logger) {
        _logger = getLogger().createChild('Watchdog');
    }
    return _logger;
}

export interface WatchdogOptions {
    thresholdMs?: number;
    label: string;
    onTimeout?: (duration: number, metadata: any) => void;
}

/**
 * Monitors execution time and reports issues if a threshold is exceeded.
 */
export class Watchdog {
    private startTime: number;
    private thresholdMs: number;
    private label: string;
    private metadata: any = {};
    private isStopped: boolean = false;
    private timer: NodeJS.Timeout | null = null;

    constructor(options: WatchdogOptions) {
        this.label = options.label;
        this.thresholdMs = options.thresholdMs || 2000;
        this.startTime = Date.now();

        // Optional: Proactive timeout reporting via background timer
        // However, if the main thread is blocked, this won't fire either.
        // We'll rely on the manual `stop()` check as well.
        this.timer = setTimeout(() => {
            if (!this.isStopped) {
                this.reportTimeout(this.thresholdMs, true);
            }
        }, this.thresholdMs);
    }

    /**
     * Add metadata to be reported if a timeout occurs.
     */
    public addMetadata(data: any): void {
        this.metadata = { ...this.metadata, ...data };
    }

    /**
     * Stop the watchdog and report if it exceeded the threshold.
     */
    public stop(): number {
        this.isStopped = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }

        const duration = Date.now() - this.startTime;
        this.reportTimeout(duration, false);
        return duration;
    }

    private reportTimeout(duration: number, proactive: boolean): void {
        if (proactive) {
            getWatchdogLogger().warn(`[Watchdog] Potential HANG detected for "${this.label}" (Pending > ${this.thresholdMs}ms)`, {
                label: this.label,
                threshold: this.thresholdMs,
                proactive,
                ...this.metadata
            });
            return;
        }

        if (duration > this.thresholdMs) {
            getWatchdogLogger().warn(`[Watchdog] PERFORMANCE VIOLATION: "${this.label}" took ${duration}ms (Max: ${this.thresholdMs}ms)`, {
                label: this.label,
                duration,
                threshold: this.thresholdMs,
                proactive,
                ...this.metadata
            });
        } else if (duration > 100) {
            getWatchdogLogger().info(`[Watchdog] Task "${this.label}" completed in ${duration}ms`, {
                label: this.label,
                duration,
                ...this.metadata
            });
        }
    }
}

/**
 * Decorator to wrap a method with a watchdog.
 */
export function watchdog(thresholdMs: number = 2000) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function (this: any, ...args: any[]) {
            const label = `${target.constructor.name}.${propertyKey}`;
            const dog = new Watchdog({ label, thresholdMs });

            // Heuristic: If the first arg is a string, it's often a path
            if (args.length > 0 && typeof args[0] === 'string') {
                dog.addMetadata({ path: args[0] });
            }

            try {
                const result = originalMethod.apply(this, args);
                if (result instanceof Promise) {
                    return result.finally(() => dog.stop());
                }
                dog.stop();
                return result;
            } catch (error) {
                dog.stop();
                throw error;
            }
        };

        return descriptor;
    };
}
