import { describe, expect, it } from 'vitest';
import type { ApiError } from '@/lib/api';
import { isInvalidEmailError, isValidEmail } from './validation';

describe('isValidEmail', () => {
  it.each(['priya@example.com', 'priya.sharma+wedding@mail.example.co.in', 'A@B.IN'])(
    'accepts %s',
    (email) => {
      expect(isValidEmail(email)).toBe(true);
    },
  );

  it.each([
    'priya@',
    'priya.example.com',
    '@example.com',
    'priya@example',
    'priya@example.',
    'priya@.com',
    'priya@@example.com',
    'priya sharma@example.com',
    '',
  ])('rejects %j', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe('isInvalidEmailError', () => {
  const error = (overrides: Partial<ApiError>): ApiError => ({
    code: 'VALIDATION_FAILED',
    message: 'The request contains invalid input.',
    status: 400,
    fields: {},
    ...overrides,
  });

  it('is true when the API rejects the email field', () => {
    expect(isInvalidEmailError(error({ fields: { email: ['email must be an email'] } }))).toBe(
      true,
    );
  });

  it('is false for other validation failures and other errors', () => {
    expect(isInvalidEmailError(error({ fields: { password: ['too short'] } }))).toBe(false);
    expect(isInvalidEmailError(error({ code: 'INVALID_CREDENTIALS', status: 401 }))).toBe(false);
  });
});
