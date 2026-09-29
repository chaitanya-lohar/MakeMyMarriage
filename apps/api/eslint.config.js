import nest from '@makemymarriage/eslint-config/nest';

export default [
  ...nest,
  {
    ignores: ['dist/**', 'scripts/**'],
  },
];
