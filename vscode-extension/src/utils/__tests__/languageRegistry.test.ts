// __tests__/languageRegistry.test.ts
import {
    getLanguageFromExtension,
    getLanguageColor,
    isCodeLanguage,
    getLanguageDisplayName,
    getCodeLanguageExtensions,
    LANGUAGE_REGISTRY
} from '../languageRegistry';

describe('languageRegistry', () => {
    describe('getLanguageFromExtension', () => {
        it('maps .ts to typescript', () => {
            expect(getLanguageFromExtension('.ts')).toBe('typescript');
        });

        it('maps .tsx to typescript', () => {
            expect(getLanguageFromExtension('.tsx')).toBe('typescript');
        });

        it('maps .js to javascript', () => {
            expect(getLanguageFromExtension('.js')).toBe('javascript');
        });

        it('maps .py to python', () => {
            expect(getLanguageFromExtension('.py')).toBe('python');
        });

        it('maps .go to go', () => {
            expect(getLanguageFromExtension('.go')).toBe('go');
        });

        it('maps .md to markdown', () => {
            expect(getLanguageFromExtension('.md')).toBe('markdown');
        });

        it('returns "other" for unknown extensions', () => {
            expect(getLanguageFromExtension('.xyz')).toBe('other');
            expect(getLanguageFromExtension('.unknown')).toBe('other');
        });

        it('is case-insensitive', () => {
            expect(getLanguageFromExtension('.TS')).toBe('typescript');
            expect(getLanguageFromExtension('.PY')).toBe('python');
        });
    });

    describe('getLanguageColor', () => {
        it('returns correct color for typescript', () => {
            expect(getLanguageColor('typescript')).toBe(0x3178C6);
        });

        it('returns correct color for javascript', () => {
            expect(getLanguageColor('javascript')).toBe(0xF7DF1E);
        });

        it('returns default color for unknown languages', () => {
            expect(getLanguageColor('unknown')).toBe(0xAAAAAA);
            expect(getLanguageColor('other')).toBe(0xAAAAAA);
        });

        it('is case-insensitive', () => {
            expect(getLanguageColor('TypeScript')).toBe(0x3178C6);
            expect(getLanguageColor('PYTHON')).toBe(0x3776AB);
        });
    });

    describe('isCodeLanguage', () => {
        it('returns true for languages that support code analysis', () => {
            expect(isCodeLanguage('typescript')).toBe(true);
            expect(isCodeLanguage('javascript')).toBe(true);
            expect(isCodeLanguage('python')).toBe(true);
            expect(isCodeLanguage('java')).toBe(true);
            expect(isCodeLanguage('go')).toBe(true);
        });

        it('returns false for non-code languages', () => {
            expect(isCodeLanguage('markdown')).toBe(false);
            expect(isCodeLanguage('json')).toBe(false);
            expect(isCodeLanguage('yaml')).toBe(false);
        });

        it('returns false for unknown languages', () => {
            expect(isCodeLanguage('unknown')).toBe(false);
            expect(isCodeLanguage('other')).toBe(false);
        });
    });

    describe('getLanguageDisplayName', () => {
        it('returns human-readable names', () => {
            expect(getLanguageDisplayName('typescript')).toBe('TypeScript');
            expect(getLanguageDisplayName('javascript')).toBe('JavaScript');
            expect(getLanguageDisplayName('csharp')).toBe('C#');
            expect(getLanguageDisplayName('cpp')).toBe('C++');
        });

        it('returns Unknown for unregistered languages', () => {
            expect(getLanguageDisplayName('xyz')).toBe('Unknown');
        });
    });

    describe('getCodeLanguageExtensions', () => {
        it('returns extensions for code languages only', () => {
            const exts = getCodeLanguageExtensions();
            expect(exts).toContain('.ts');
            expect(exts).toContain('.py');
            expect(exts).toContain('.go');
            expect(exts).not.toContain('.md');
            expect(exts).not.toContain('.json');
        });
    });

    describe('LANGUAGE_REGISTRY', () => {
        it('has consistent supportsCodeAnalysis for known code languages', () => {
            const codeLanguages = ['typescript', 'javascript', 'python', 'java', 'go', 'csharp', 'cpp', 'c'];
            for (const lang of codeLanguages) {
                expect(LANGUAGE_REGISTRY[lang]?.supportsCodeAnalysis).toBe(true);
            }
        });

        it('all languages have required properties', () => {
            for (const [id, def] of Object.entries(LANGUAGE_REGISTRY)) {
                expect(def.name).toBeDefined();
                expect(def.extensions.length).toBeGreaterThan(0);
                expect(typeof def.color).toBe('number');
                expect(typeof def.supportsCodeAnalysis).toBe('boolean');
            }
        });
    });
});
