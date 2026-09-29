import base from '@makemymarriage/eslint-config/base';

export default [
  ...base,
  {
    // Generated from openapi.json by `pnpm api:contract`.
    ignores: ['src/schema.d.ts'],
  },
];
