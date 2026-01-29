import { profile } from '../profiling';
import { PerfTracker } from '../perf-tracker';

describe('@profile Decorator (Behavioral)', () => {
    let perf: PerfTracker;

    beforeEach(() => {
        perf = new PerfTracker();
        // Set the global singleton to our test instance
        PerfTracker.instance = perf;
    });

    it('should trace method execution in real PerfTracker', () => {
        class TestClass {
            @profile()
            doSomething() {
                return 'result';
            }
        }

        const instance = new TestClass();
        const result = instance.doSomething();

        expect(result).toBe('result');

        const stats = perf.getStats();
        const entry = stats.find(s => s.label === 'TestClass.doSomething');
        expect(entry).toBeDefined();
        expect(entry?.count).toBe(1);
    });

    it('should trace async method execution and wait for promise', async () => {
        class TestClass {
            @profile()
            async doSomethingAsync() {
                await new Promise(resolve => setTimeout(resolve, 30));
                return 'async-result';
            }
        }

        const instance = new TestClass();
        const result = await instance.doSomethingAsync();

        expect(result).toBe('async-result');

        const stats = perf.getStats();
        const entry = stats.find(s => s.label === 'TestClass.doSomethingAsync');
        expect(entry).toBeDefined();
        // Verify that the duration is realistic (around 30ms, allowing for jitter)
        expect(entry?.avg).toBeGreaterThanOrEqual(25);
        expect(entry?.avg).toBeLessThan(150);
    });

    it('should use custom label in PerfTracker', () => {
        class TestClass {
            @profile('CustomLabel')
            doSomething() {
                return 'result';
            }
        }

        const instance = new TestClass();
        instance.doSomething();

        const stats = perf.getStats();
        expect(stats.some(s => s.label === 'CustomLabel')).toBe(true);
    });

    it('should handle errors and still record the event', () => {
        class TestClass {
            @profile('ErrorTask')
            fail() {
                throw new Error('Expected fail');
            }
        }

        const instance = new TestClass();
        expect(() => instance.fail()).toThrow('Expected fail');

        const stats = perf.getStats();
        expect(stats.some(s => s.label === 'ErrorTask')).toBe(true);
    });
});
