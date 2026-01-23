/**
 * TEST FILE - Intentional circular dependency
 * This file imports from circular-b.ts which imports back from this file.
 * Should trigger a "no-circular" violation.
 */
import { functionB } from './circular-b';

export function functionA(): string {
    return 'A calls ' + functionB();
}
