/**
 * TEST FILE - Intentional layer violation
 * This "core" module imports from a "webview" module, which is a layer violation.
 * Core should not depend on webview.
 */
// This import violates the architecture - core importing from webview
import { WarningOverlay } from '../../../webview/warning-overlay';

export function coreFunction(): void {
    // This is bad architecture - core shouldn't know about UI
    console.log('Core function accessing UI:', WarningOverlay);
}
