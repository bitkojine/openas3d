import * as vscode from 'vscode';
import { ErrorRecoverySystem, ErrorCategory, ErrorSeverity } from '../error-recovery';
import { LifecycleCoordinator, EventType } from '../lifecycle-coordinator';

jest.mock('vscode', () => ({
    window: {
        showErrorMessage: jest.fn().mockResolvedValue(undefined),
        showWarningMessage: jest.fn().mockResolvedValue(undefined)
    },
    Disposable: jest.fn()
}), { virtual: true });

// Mock Logger
jest.mock('../logger', () => ({
    Logger: {
        getInstance: jest.fn().mockReturnValue({
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn()
        })
    }
}));

describe('ErrorRecoverySystem', () => {
    let errorRecovery: ErrorRecoverySystem;
    let mockLifecycle: LifecycleCoordinator;

    beforeEach(() => {
        jest.clearAllMocks();
        mockLifecycle = new LifecycleCoordinator();
        errorRecovery = new ErrorRecoverySystem(mockLifecycle);
    });

    afterEach(() => {
        errorRecovery.dispose();
    });

    /**
     * Tests that reportError correctly records error details in the internal log.
     */
    it('should record and log errors', async () => {
        await errorRecovery.reportError(
            ErrorCategory.FILE_SYSTEM,
            ErrorSeverity.MEDIUM,
            'Failed to read file'
        );

        const errors = errorRecovery.getErrors();
        expect(errors.length).toBe(1);
    });

    /**
     * Tests the automated recovery mechanism.
     * Verifies that when a strategy is registered for an error category,
     * it is invoked when a matching error is reported.
     */
    it('should attempt recovery using registered strategies', async () => {
        const strategy = {
            canRecover: jest.fn().mockReturnValue(true),
            recover: jest.fn().mockResolvedValue(true),
            maxAttempts: 3,
            cooldownMs: 0
        };

        errorRecovery.addStrategy(ErrorCategory.ANALYSIS, strategy);

        const recovered = await errorRecovery.reportError(
            ErrorCategory.ANALYSIS,
            ErrorSeverity.HIGH,
            'Timeout during analysis'
        );

        expect(strategy.canRecover).toHaveBeenCalled();
        expect(strategy.recover).toHaveBeenCalled();
        expect(recovered).toBe(true);
    });

    /**
     * Tests the circuit breaker pattern.
     * Verifies that if too many errors occur within a short window, the system
     * "trips" the circuit and stops attempting recovery to prevent cascading failures.
     */
    it('should trigger circuit breaker after threshold', async () => {
        // Report errors quickly
        for (let i = 0; i < 5; i++) {
            await errorRecovery.reportError(
                ErrorCategory.WEBVIEW,
                ErrorSeverity.MEDIUM,
                `Webview crash ${i}`
            );
        }

        // Manually trigger error rate check (normally on timer)
        (errorRecovery as any).checkErrorRate();

        const status = errorRecovery.getCircuitBreakerStatus();
        expect(status.has(ErrorCategory.WEBVIEW)).toBe(true);
        expect(status.get(ErrorCategory.WEBVIEW)?.isOpen).toBe(true);

        // Subsequent reports should return false immediately
        const recovered = await errorRecovery.reportError(
            ErrorCategory.WEBVIEW,
            ErrorSeverity.LOW,
            'One more error'
        );
        expect(recovered).toBe(false);
    });

    /**
     * Tests retry limits for recovery strategies.
     * Verifies that the system does not exceed the maximum number of recovery
     * attempts allowed by a strategy.
     */
    it('should respect max attempts for recovery', async () => {
        const strategy = {
            canRecover: jest.fn().mockReturnValue(true),
            recover: jest.fn().mockResolvedValue(false), // Always fail
            maxAttempts: 2,
            cooldownMs: 0
        };

        errorRecovery.addStrategy(ErrorCategory.ANALYSIS, strategy);

        await errorRecovery.reportError(ErrorCategory.ANALYSIS, ErrorSeverity.MEDIUM, 'Fail 1');
        await errorRecovery.reportError(ErrorCategory.ANALYSIS, ErrorSeverity.MEDIUM, 'Fail 2');
        await errorRecovery.reportError(ErrorCategory.ANALYSIS, ErrorSeverity.MEDIUM, 'Fail 3');

        expect(strategy.recover).toHaveBeenCalledTimes(2);
    });

    /**
     * Tests the reset logic for recovery attempts.
     * Verifies that a successful recovery operation resets the retry counter
     * for that error category.
     */
    it('should reset attempt count on successful recovery', async () => {
        let shouldSucceed = false;
        const strategy = {
            canRecover: jest.fn().mockReturnValue(true),
            recover: jest.fn().mockImplementation(async () => shouldSucceed),
            maxAttempts: 3,
            cooldownMs: 0
        };

        errorRecovery.addStrategy(ErrorCategory.ANALYSIS, strategy);

        await errorRecovery.reportError(ErrorCategory.ANALYSIS, ErrorSeverity.MEDIUM, 'Fail 1');
        shouldSucceed = true;
        await errorRecovery.reportError(ErrorCategory.ANALYSIS, ErrorSeverity.MEDIUM, 'Success');

        // Next one should start from 0 attempts
        shouldSucceed = false;
        await errorRecovery.reportError(ErrorCategory.ANALYSIS, ErrorSeverity.MEDIUM, 'Fail 2');

        expect(strategy.recover).toHaveBeenCalledTimes(3);
    });

    /**
     * Tests user-facing notifications based on error severity.
     * Verifies that HIGH severity errors show an Error message and MEDIUM
     * severity errors show a Warning message in VS Code.
     */
    it('should show user messages for high/critical severity', async () => {
        await errorRecovery.reportError(ErrorCategory.ANALYSIS, ErrorSeverity.HIGH, 'Critical fail');
        expect(vscode.window.showErrorMessage).toHaveBeenCalled();

        await errorRecovery.reportError(ErrorCategory.FILE_SYSTEM, ErrorSeverity.MEDIUM, 'Minor fail');
        expect(vscode.window.showWarningMessage).toHaveBeenCalled();
    });

    /**
     * Tests the cleanup logic.
     * Verifies that disposing the ErrorRecoverySystem clears all recorded
     * error history.
     */
    it('should dispose correctly', async () => {
        await errorRecovery.reportError(ErrorCategory.FILE_SYSTEM, ErrorSeverity.LOW, 'Test error');
        expect(errorRecovery.getErrors().length).toBe(1);

        errorRecovery.dispose();
        const errors = errorRecovery.getErrors();
        expect(errors.length).toBe(0);
    });
});
