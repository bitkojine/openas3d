
import { PerfTracker } from './perf-tracker';

/**
 * Method decorator to profile execution time.
 * Uses the global PerfTracker.instance.
 * 
 * @param label Optional label. Defaults to ClassName.MethodName
 */
export function profile(label?: string) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;

        descriptor.value = function (this: any, ...args: any[]) {
            const tracker = PerfTracker.instance;
            if (!tracker) {
                return originalMethod.apply(this, args);
            }

            const methodLabel = label || `${target.constructor.name}.${propertyKey}`;
            const start = tracker.start(methodLabel);

            try {
                const result = originalMethod.apply(this, args);
                if (result instanceof Promise) {
                    return result.finally(() => {
                        tracker.stop(methodLabel, start);
                    });
                }
                tracker.stop(methodLabel, start);
                return result;
            } catch (error) {
                tracker.stop(methodLabel, start);
                throw error;
            }
        };

        return descriptor;
    } as any;
}
