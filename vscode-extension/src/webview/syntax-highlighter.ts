import * as THREE from 'three';
import { ThemeColors } from '../shared/types';

/** Token with text and color */
export interface SyntaxToken {
    text: string;
    color: string;
}

/** Standard VS Code Dark+ palette */
export const DARK_SYNTAX = {
    background: '#1e1e1e',
    text: '#d4d4d4',
    keyword: '#569cd6',
    string: '#ce9178',
    comment: '#6a9955',
    number: '#b5cea8',
    function: '#dcdcaa',
    type: '#4ec9b0',
    lineNumber: '#858585',
    lineNumberBg: '#252526'
};

/** Standard VS Code Light+ palette */
export const LIGHT_SYNTAX = {
    background: '#ffffff',
    text: '#000000',
    keyword: '#0000ff',
    string: '#a31515',
    comment: '#008000',
    number: '#098658',
    function: '#795e26',
    type: '#2b91af',
    lineNumber: '#2b91af',
    lineNumberBg: '#f0f0f0'
};

/**
 * Get syntax colors based on the current theme.
 * Tries to infer "light" vs "dark" from editorBackground if checking fails.
 */
export function getSyntaxColors(theme?: ThemeColors) {
    if (theme) {
        // use theme.editorForeground for base text if available

        try {
            const bg = theme.editorBackground;
            const col = new THREE.Color(bg);
            const isLight = col.getHSL({ h: 0, s: 0, l: 0 }).l > 0.5;

            const syntax = isLight ? LIGHT_SYNTAX : DARK_SYNTAX;

            // Allow overriding base text color with theme's foreground
            return {
                ...syntax,
                text: theme.editorForeground || syntax.text,
                background: theme.editorBackground || syntax.background,
                lineNumberBg: theme.editorBackground || syntax.lineNumberBg // blend it later
            };
        } catch (e) {
            // fallback
        }
    }
    return DARK_SYNTAX;
}

export const SYNTAX_COLORS = DARK_SYNTAX;

const KEYWORDS = new Set([
    // JavaScript/TypeScript
    'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do',
    'switch', 'case', 'break', 'continue', 'default', 'try', 'catch', 'finally', 'throw',
    'new', 'delete', 'typeof', 'instanceof', 'void', 'this', 'super', 'class', 'extends',
    'import', 'export', 'from', 'as', 'async', 'await', 'yield', 'static',
    'public', 'private', 'protected', 'readonly', 'abstract', 'interface', 'type', 'enum',
    'implements', 'namespace', 'module', 'declare', 'get', 'set', 'constructor',
    'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
    // Python
    'def', 'elif', 'except', 'with', 'raise', 'pass',
    'and', 'or', 'not', 'in', 'is', 'lambda', 'global', 'nonlocal', 'True', 'False', 'None'
]);

export function tokenizeLine(line: string, theme?: ThemeColors): SyntaxToken[] {
    const colors = getSyntaxColors(theme);
    const tokens: SyntaxToken[] = [];
    let remaining = line;
    let inString: string | null = null;

    // Safety break to prevent infinite loops on weird inputs
    let iterations = 0;
    const MAX_ITER = 1000;

    while (remaining.length > 0 && iterations < MAX_ITER) {
        iterations++;

        // 1. Comments
        if (!inString && (remaining.startsWith('//') || remaining.startsWith('#'))) {
            tokens.push({ text: remaining, color: colors.comment });
            break;
        }

        // 2. Strings
        if (inString) {
            let endIdx = 0;
            // find close quote
            while (endIdx < remaining.length) {
                if (remaining[endIdx] === inString && remaining[endIdx - 1] !== '\\') {
                    endIdx++;
                    break;
                }
                endIdx++;
            }
            if (endIdx === 0 && remaining.length > 0) endIdx = remaining.length; // run to end if no close

            tokens.push({ text: remaining.slice(0, endIdx), color: colors.string });
            remaining = remaining.slice(endIdx);
            if (endIdx > 0 && remaining.length === 0) inString = null; // cleared
            else inString = null; // closed
            continue;
        }

        const stringMatch = remaining.match(/^(['"`])/);
        if (stringMatch) {
            inString = stringMatch[1];
            tokens.push({ text: stringMatch[0], color: colors.string });
            remaining = remaining.slice(1);
            continue;
        }

        // 3. Numbers
        const numberMatch = remaining.match(/^(\d+\.?\d*)/);
        if (numberMatch && (tokens.length === 0 || /[\W]$/.test(tokens[tokens.length - 1]?.text || ' '))) {
            tokens.push({ text: numberMatch[1], color: colors.number });
            remaining = remaining.slice(numberMatch[1].length);
            continue;
        }

        // 4. Words (Keywords, Functions, Types, Text)
        const wordMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (wordMatch) {
            const word = wordMatch[1];
            let color = colors.text;

            if (KEYWORDS.has(word)) {
                color = colors.keyword;
            } else if (/^[A-Z]/.test(word)) {
                color = colors.type;
            } else if (remaining.length > word.length && remaining[word.length] === '(') {
                color = colors.function;
            }

            tokens.push({ text: word, color });
            remaining = remaining.slice(word.length);
            continue;
        }

        // 5. Punctuation / Operators / Whitespace
        // Consume one char
        tokens.push({ text: remaining[0], color: colors.text });
        remaining = remaining.slice(1);
    }

    // clean up fallback
    if (remaining.length > 0) {
        tokens.push({ text: remaining, color: colors.text });
    }

    return tokens;
}
