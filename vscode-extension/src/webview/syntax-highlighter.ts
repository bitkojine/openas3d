/**
 * Syntax highlighting for code rendered on 3D objects.
 * VS Code dark theme inspired color palette.
 */

/** Token with text and color */
export interface SyntaxToken {
    text: string;
    color: string;
}

/** VS Code dark theme inspired color palette */
export const SYNTAX_COLORS = {
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
} as const;

/** Keywords for various programming languages */
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
    'and', 'or', 'not', 'in', 'is', 'lambda', 'global', 'nonlocal', 'True', 'False', 'None',
    // Common types
    'int', 'float', 'double', 'string', 'boolean', 'bool', 'char', 'byte', 'long'
]);

/**
 * Tokenize a line of code for syntax highlighting
 */
export function tokenizeLine(line: string): SyntaxToken[] {
    const tokens: SyntaxToken[] = [];
    let remaining = line;
    let inString: string | null = null;

    while (remaining.length > 0) {
        // Check for line comment
        if (!inString && (remaining.startsWith('//') || remaining.startsWith('#'))) {
            tokens.push({ text: remaining, color: SYNTAX_COLORS.comment });
            break;
        }

        // Check for string start/end
        const stringMatch = remaining.match(/^(['"`])/);
        if (stringMatch && !inString) {
            inString = stringMatch[1];
            // Find end of string
            let endIdx = 1;
            while (endIdx < remaining.length) {
                if (remaining[endIdx] === inString && remaining[endIdx - 1] !== '\\') {
                    endIdx++;
                    break;
                }
                endIdx++;
            }
            tokens.push({ text: remaining.slice(0, endIdx), color: SYNTAX_COLORS.string });
            remaining = remaining.slice(endIdx);
            inString = null;
            continue;
        }

        // Check for numbers
        const numberMatch = remaining.match(/^(\d+\.?\d*)/);
        if (numberMatch && (tokens.length === 0 || /\W$/.test(tokens[tokens.length - 1]?.text || ''))) {
            tokens.push({ text: numberMatch[1], color: SYNTAX_COLORS.number });
            remaining = remaining.slice(numberMatch[1].length);
            continue;
        }

        // Check for keywords and identifiers
        const wordMatch = remaining.match(/^([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        if (wordMatch) {
            const word = wordMatch[1];
            if (KEYWORDS.has(word)) {
                tokens.push({ text: word, color: SYNTAX_COLORS.keyword });
            } else if (remaining.slice(word.length).match(/^\s*\(/)) {
                // Followed by ( - likely a function call
                tokens.push({ text: word, color: SYNTAX_COLORS.function });
            } else if (word[0] === word[0].toUpperCase() && word.length > 1) {
                // PascalCase - likely a type
                tokens.push({ text: word, color: SYNTAX_COLORS.type });
            } else {
                tokens.push({ text: word, color: SYNTAX_COLORS.text });
            }
            remaining = remaining.slice(word.length);
            continue;
        }

        // Default: single character
        tokens.push({ text: remaining[0], color: SYNTAX_COLORS.text });
        remaining = remaining.slice(1);
    }

    return tokens;
}
