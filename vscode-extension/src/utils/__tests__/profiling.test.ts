
import { profile } from '../profiling';
import { PerfTracker } from '../perf-tracker';

describe('@profile Decorator', () => {
    let perf: PerfTracker;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let trackerSpy: jest.SpyInstance;

    beforeEach(() => {
        perf = new PerfTracker();
        PerfTracker.instance = perf;
        trackerSpy = jest.spyOn(perf, 'start');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should trace method execution', () => {
        class TestClass {
            @profile()
            doSomething() {
                return 'result';
            }
        }

        const instance = new TestClass();
        const result = instance.doSomething();

        expect(result).toBe('result');
        expect(trackerSpy).toHaveBeenCalledWith('TestClass.doSomething');
    });

    it('should trace async method execution and wait for promise', async () => {
        class TestClass {
            @profile()
            async doSomethingAsync() {
                await new Promise(resolve => setTimeout(resolve, 10));
                return 'async-result';
            }
        }

        const instance = new TestClass();
        const result = await instance.doSomethingAsync();

        expect(result).toBe('async-result');
        expect(trackerSpy).toHaveBeenCalledWith('TestClass.doSomethingAsync');
    });

    it('should use custom label', () => {
        class TestClass {
            @profile('CustomLabel')
            doSomething() {
                return 'result';
            }
        }

        const instance = new TestClass();
        instance.doSomething();

        expect(trackerSpy).toHaveBeenCalledWith('CustomLabel');
    });
});
