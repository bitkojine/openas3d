/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
    options: {
        /* Rules for architectural layers (Zones) */
        doNotFollow: {
            path: 'node_modules',
            dependencyTypes: ['npm', 'npm-dev', 'npm-optional', 'npm-peer', 'npm-bundled', 'npm-no-pkg']
        },
        exclude: {
            path: [
                'node_modules',
                '\\.vscode-test',
                '\\.vscode',
                '__mocks__',
                '__tests__',
                '\\.test\\.',
                '\\.spec\\.',
                'out',
                'dist',
                '\\.d\\.ts$',
                'architecture-analyzer\\.ts$'  // Exclude - has problematic new Function() pattern
            ].join('|')
        },
        moduleSystems: ['es6', 'cjs'],
        tsPreCompilationDeps: false,  // Disable to avoid parsing type files
        parser: 'tsc',  // Use tsc parser
        externalModuleResolutionStrategy: 'node_modules',
        // tsConfig is set programmatically by the analyzer to use absolute path
        enhancedResolveOptions: {
            exportsFields: ['exports'],
            conditionNames: ['import', 'require', 'node', 'default']
        },
        reporterOptions: {
            dot: {
                collapsePattern: 'node_modules/[^/]+'
            },
            archi: {
                collapsePattern: '^(packages|src|lib|app|bin|test(s?)|spec(s?))/[^/]+|node_modules/[^/]+'
            }
        }
    },
    forbidden: [
        /* RULES */
        {
            name: 'no-circular',
            severity: 'warn',
            comment:
                'This dependency is part of a circular relationship. You might want to revise ' +
                'your solution (i.e. use dependency inversion, make sure the modules have a single responsibility) ',
            from: {},
            to: {
                circular: true
            }
        },
        {
            name: 'no-orphans',
            severity: 'info',
            comment:
                "This is an orphan module - it's likely not used (anymore?). Either use it or " +
                "remove it. If it's logical this module is an orphan (i.e. it's a config file), " +
                "add an exception for it in your dependency-cruiser configuration. By default " +
                "this rule does not scrutinize dot-files (e.g. .eslintrc.js), TypeScript declaration " +
                "files (.d.ts), tsconfig.json and some of the babel and webpack configs.",
            from: {
                orphan: true,
                pathNot: [
                    '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$', // dot files
                    '\\.d\\.ts$',                            // declaration files
                    '(^|/)tsconfig\\.json$',
                    '(^|/)(babel|webpack)\\.config\\.(js|cjs|mjs|ts|json)$'
                ]
            },
            to: {}
        },
        {
            name: 'no-deprecated-core',
            comment: 'A module depends on a deprecated core module',
            severity: 'warn',
            from: {},
            to: {
                dependencyTypes: [
                    'core'
                ]
            }
        },
        {
            name: 'not-to-unresolvable',
            comment:
                "This module depends on a module that cannot be found ('resolved') to a valid file. " +
                "Revision to the code that caused this is likely necessary.",
            severity: 'error',
            from: {},
            to: {
                couldNotResolve: true
            }
        },

        /* LAYER VIOLATIONS - Matching ZoneClassifier logic roughly */
        /* 
           Layers (High to Low): 
           entry -> api -> core -> data -> lib
           ui -> core, data, lib 
        */

        {
            name: 'layer-data-lib-only',
            comment: 'Data layer should only depend on Lib layer (or itself)',
            severity: 'warn',
            from: { path: '(^|/)src/.*(models?|schemas?|entities?|repositories?|database|db)/.+' },
            to: {
                pathNot: [
                    '(^|/)src/.*(models?|schemas?|entities?|repositories?|database|db)/.+', // Self
                    '(^|/)src/.*(utils?|helpers?|lib|common|shared)/.+', // Lib
                    '(^|/)node_modules/' // External deps
                ]
            }
        },
        {
            name: 'layer-core-no-entry-ui',
            comment: 'Core layer should not depend on Entry or UI layers',
            severity: 'warn',
            from: { path: '(^|/)src/.*(services?|domain|core|business|managers?)/.+' },
            to: {
                path: [
                    '(^|/)src/.*(main|index|app|cli|bin)/.+', // Entry
                    '(^|/)src/.*(components?|views?|pages?|ui)/.+' // UI
                ]
            }
        },
        {
            name: 'layer-lib-standalone',
            comment: 'Lib layer should be standalone (no dependencies on other layers)',
            severity: 'warn',
            from: { path: '(^|/)src/.*(utils?|helpers?|lib|common|shared)/.+' },
            to: {
                path: [
                    '(^|/)src/.*(models?|schemas?|entities?|repositories?|database|db)/.+',
                    '(^|/)src/.*(services?|domain|core|business|managers?)/.+',
                    '(^|/)src/.*(api|routes?|controllers?)/.+',
                    '(^|/)src/.*(components?|views?|pages?|ui)/.+',
                    '(^|/)src/.*(main|index|app|cli|bin)/.+'
                ]
            }
        }
    ]
};
