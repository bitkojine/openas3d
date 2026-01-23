/**
 * TEST FILE - Intentional circular dependency
 * This file imports from circular-a.ts which imports back from this file.
 * Should trigger a "no-circular" violation.
 */
import { functionA } from './circular-a';

export function functionB(): string {
    return 'B calls ' + functionA();
}
