import { Watchdog } from '../watchdog';
import { getLogger } from '../logger';

// Mock the logger to avoid VSCode API dependencies
jest.mock('../logger', () => {
    const mockLogger: any = {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        createChild: jest.fn(() => mockLogger),
    };
    return {
        getLogger: jest.fn(() => mockLogger),
        LogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3, NONE: 4 }
    };
});

describe('Watchdog', () => {
    let mockLogger: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockLogger = getLogger();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should calculate duration correctly', () => {
        // Use real timers for the manual Date.now check
        jest.useRealTimers();
        const dog = new Watchdog({ label: 'test-duration', thresholdMs: 100 });

        // Manual busy wait to ensure Date.now() moves
        const start = Date.now();
        while (Date.now() - start < 15) { }

        const duration = dog.stop();
        expect(duration).toBeGreaterThanOrEqual(15);
    });

    it('should report performance violation if threshold exceeded via stop()', () => {
        const start = 1000;
        const end = 3100; // 2.1 seconds

        const nowSpy = jest.spyOn(Date, 'now');
        nowSpy.mockReturnValueOnce(start)  // Start
            .mockReturnValueOnce(end);    // Stop

        try {
            const dog = new Watchdog({ label: 'test-violation', thresholdMs: 2000 });
            dog.stop();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('PERFORMANCE VIOLATION: "test-violation" took 2100ms'),
                expect.objectContaining({ label: 'test-violation', duration: 2100 })
            );
        } finally {
            nowSpy.mockRestore();
        }
    });

    it('should proactively report potential hang via timer', () => {
        new Watchdog({ label: 'test-hang', thresholdMs: 2000 });

        // Advance time by 2001ms
        jest.advanceTimersByTime(2001);

        expect(mockLogger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Potential HANG detected for "test-hang"'),
            expect.objectContaining({ proactive: true, threshold: 2000 })
        );
    });

    it('should not report if stopped manually within threshold', () => {
        const dog = new Watchdog({ label: 'test-ok', thresholdMs: 2000 });

        // Advance time by only 500ms
        jest.advanceTimersByTime(500);

        dog.stop();

        // Verify no proactive report from timer (since it's cleared) and no violation report
        expect(mockLogger.warn).not.toHaveBeenCalled();
    });

    it('should capture additional metadata', () => {
        const nowSpy = jest.spyOn(Date, 'now');
        nowSpy.mockReturnValueOnce(1000) // Constructor
            .mockReturnValueOnce(1500); // Stop

        try {
            const dog = new Watchdog({ label: 'test-meta', thresholdMs: 10 });
            dog.addMetadata({ fileId: '123', size: 1024 });
            dog.stop();

            expect(mockLogger.warn).toHaveBeenCalledWith(
                expect.stringContaining('PERFORMANCE VIOLATION'),
                expect.objectContaining({ fileId: '123', size: 1024, duration: 500 })
            );
        } finally {
            nowSpy.mockRestore();
        }
    });
});
