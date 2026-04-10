import standard from 'eslint-config-standard';
import standardJs from '@eslint/js';
import globals from 'globals';

export default [
  { languageOptions: { globals: globals.node } },
  standardJs.configs.recommended,
  ...standard,
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'max-len': ['error', { code: 100 }],
      'prefer-const': 'error',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'import/no-unresolved': 'off',
      'n/no-missing-import': 'off',
    },
    ignores: ['node_modules/**', 'dist/**'],
  },
];
