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
 * module's persistence). Imports inside a module are unrestricted, except that
 * persistence is confined to the module's infrastructure layer (see below).
 */
const persistenceMessage =
  'Mongoose/MongoDB belong in the module infrastructure layer; use a repository and domain types.';

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
    // Persistence stays behind each module's infrastructure layer (decision 0006):
    // controllers, DTOs, use-cases, services and domain code never touch Mongoose or
    // Mongoose schemas. Repositories translate documents into domain types. The
    // <feature>.module.ts file may still register schemas with MongooseModule.forFeature().
    files: [
      'src/modules/*/api/**/*.ts',
      'src/modules/*/application/**/*.ts',
      'src/modules/*/domain/**/*.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'mongoose', message: persistenceMessage },
            { name: '@nestjs/mongoose', message: persistenceMessage },
            { name: 'mongodb', message: persistenceMessage },
          ],
          patterns: [
            { group: ['mongoose/*', 'mongodb/*'], message: persistenceMessage },
            { group: ['**/infrastructure/schemas/**'], message: persistenceMessage },
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
