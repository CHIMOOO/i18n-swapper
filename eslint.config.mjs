import tsParser from '@typescript-eslint/parser';
import vueParser from 'vue-eslint-parser';

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'src/webview/dist/**',
      'src/webview/node_modules/**',
    ],
  },
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: tsParser,
    },
  },
  {
    files: ['src/**/*.vue'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parser: vueParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        parser: tsParser,
      },
    },
  },
];
