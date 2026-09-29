import nextPlugin from '@next/eslint-plugin-next';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import base from './base.js';

/** Next.js (App Router) configuration. */
export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  nextPlugin.configs['core-web-vitals'],
  reactHooks.configs.flat.recommended,
];
