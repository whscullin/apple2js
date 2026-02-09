import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import jest from 'eslint-plugin-jest';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
    // Global ignores
    {
        ignores: [
            'coverage/**',
            'dist/**',
            'json/disks/index.js',
            'node_modules/**',
            'submodules/**',
            'tmp/**',
        ],
    },

    // Base config
    js.configs.recommended,

    // Base rules for all files
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.es2021,
            },
        },
        rules: {
            'linebreak-style': ['error', 'unix'],
            eqeqeq: ['error', 'smart'],
            'prefer-const': ['error'],
            'no-var': 'error',
            'no-use-before-define': 'off',
            'no-console': ['error', { allow: ['info', 'warn', 'error'] }],
        },
    },

    // TypeScript/TSX-specific configuration
    {
        files: ['**/*.ts', '**/*.tsx'],
        extends: [
            ...tseslint.configs.recommended,
            ...tseslint.configs.recommendedTypeChecked,
        ],
        plugins: {
            react,
            'react-hooks': reactHooks,
        },
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
        settings: {
            react: {
                version: 'detect',
            },
        },
        rules: {
            ...react.configs.recommended.rules,
            ...reactHooks.configs.recommended.rules,
            // recommended is just "warn"
            '@typescript-eslint/no-explicit-any': 'error',
            // definitions must come before uses for variables
            '@typescript-eslint/no-use-before-define': [
                'error',
                { functions: false, classes: false },
            ],
            // no unused variables
            'no-unused-vars': 'off',
            '@typescript-eslint/no-unused-vars': [
                'error',
                { argsIgnorePattern: '^_' },
            ],
            // no redeclaration of classes, members or variables
            'no-redeclare': 'off',
            // allow empty interface definitions and empty extends
            '@typescript-eslint/no-empty-object-type': 'off',
            // allow explicit type declaration
            '@typescript-eslint/no-inferrable-types': 'off',
            // allow some non-string types in templates
            '@typescript-eslint/restrict-template-expressions': [
                'error',
                { allowNumber: true, allowBoolean: true },
            ],
            '@typescript-eslint/require-await': 'off',
            // these rules are new in @typescript-eslint v8; disable to
            // preserve existing behavior
            '@typescript-eslint/no-unused-expressions': 'off',
            '@typescript-eslint/no-array-delete': 'off',
            '@typescript-eslint/prefer-promise-reject-errors': 'off',
            '@typescript-eslint/no-duplicate-type-constituents': 'off',
            '@typescript-eslint/no-misused-promises': [
                'error',
                { checksVoidReturn: false },
            ],
            // react rules
            'react/react-in-jsx-scope': 'off',
            'react-hooks/rules-of-hooks': 'error',
            'react-hooks/exhaustive-deps': 'error',
        },
    },

    // UI elements
    {
        files: ['js/ui/**/*.ts'],
        rules: {
            // allow non-null assertions since these classes reference the DOM
            '@typescript-eslint/no-non-null-assertion': 'off',
        },
    },

    // JS Node configuration
    {
        files: [
            'bin/*',
            'babel.config.js',
            'webpack.config.js',
            'eslint.config.mjs',
        ],
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'no-console': 0,
        },
    },

    // Test configuration
    {
        files: ['test/**/*'],
        plugins: { jest },
        languageOptions: {
            globals: {
                ...globals.jest,
                ...globals.node,
            },
        },
        rules: {
            ...jest.configs['flat/recommended'].rules,
            'jest/expect-expect': [
                'error',
                {
                    assertFunctionNames: [
                        'expect*',
                        'checkImageData',
                        'testCode',
                    ],
                },
            ],
            'no-console': 0,
        },
    },

    // Entry point configuration
    {
        files: ['js/entry2.ts', 'js/entry2e.ts', 'jest.config.js'],
        languageOptions: {
            globals: {
                ...globals.commonjs,
            },
        },
    },

    // Worker configuration
    {
        files: ['workers/**/*'],
        languageOptions: {
            parserOptions: {
                projectService: {
                    defaultProject: 'workers/tsconfig.json',
                },
            },
        },
    },

    // Prettier must be last to override other formatting rules
    prettierRecommended
);
