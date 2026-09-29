import boundaries from 'eslint-plugin-boundaries';
import globals from 'globals';
import base from './base.js';

/**
 * NestJS modular-monolith configuration.
 *
 * Module boundary rule: code outside a domain module may import it only through the
 * module's public entry point (`src/modules/<name>/index.ts`). Controllers, services,
 * schemas and repositories are private to their module (System Design §6: modules
 * communicate through application services and contracts, never through another
 * module's persistence). Imports inside a module are unrestricted.
 */
export default [
  ...base,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
  },
  {
    files: ['src/**/*.ts'],
    plugins: { boundaries },
    settings: {
      // Resolves NodeNext `.js` specifiers to their `.ts` sources.
      'import/resolver': { typescript: { alwaysTryTypes: true } },
      // First match wins: domain modules, then all remaining application code
      // (infrastructure, common, platform, bootstrap) so its imports are checked too.
      'boundaries/elements': [
        { type: 'domain-module', pattern: 'src/modules/*', capture: ['moduleName'] },
        { type: 'application', pattern: 'src' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          default: 'allow',
          policies: [
            {
              to: { element: { type: 'domain-module' } },
              disallow: { to: { element: { fileInternalPath: '!index.ts' } } },
              message:
                'Import other domain modules only through their public entry point (index.ts).',
            },
            {
              // Inside a module, any of its own files may be imported.
              from: {
                element: {
                  type: 'domain-module',
                  captured: { moduleName: '{{ to.captured.moduleName }}' },
                },
              },
              allow: { to: { element: { type: 'domain-module' } } },
            },
          ],
        },
      ],
    },
  },
  {
    // supertest response bodies and Nest's getHttpServer() are typed `any`.
    files: ['test/**/*.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
];
