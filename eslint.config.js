// ESLint flat config: core correctness rules, browser + node globals.
export default [
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        window: 'readonly', document: 'readonly', navigator: 'readonly', localStorage: 'readonly', location: 'readonly',
        performance: 'readonly', requestAnimationFrame: 'readonly', getComputedStyle: 'readonly', setTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly', URLSearchParams: 'readonly', CSS: 'readonly', self: 'readonly',
        caches: 'readonly', fetch: 'readonly', console: 'readonly', process: 'readonly', Buffer: 'readonly', URL: 'readonly', File: 'readonly',
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      'no-unreachable': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-else-if': 'error',
      'no-duplicate-case': 'error',
      'no-redeclare': 'error',
      'no-const-assign': 'error',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-unsafe-negation': 'error',
      'no-cond-assign': ['error', 'except-parens'],
      'no-constant-condition': ['error', { checkLoops: false }],
      'no-fallthrough': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      'no-loss-of-precision': 'error',
      'no-unused-private-class-members': 'error',
    },
  },
];
