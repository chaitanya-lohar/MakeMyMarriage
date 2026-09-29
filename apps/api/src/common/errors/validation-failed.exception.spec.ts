import type { ValidationError } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { ValidationFailedException } from './validation-failed.exception.js';

describe('ValidationFailedException.fromValidationErrors', () => {
  it('flattens nested errors into dotted field paths', () => {
    const errors: ValidationError[] = [
      { property: 'email', constraints: { isEmail: 'email must be an email' }, children: [] },
      {
        property: 'venue',
        children: [
          {
            property: 'name',
            constraints: { isNotEmpty: 'name should not be empty' },
            children: [],
          },
        ],
      },
    ];

    const exception = ValidationFailedException.fromValidationErrors(errors);

    expect(exception.fields).toEqual({
      email: ['email must be an email'],
      'venue.name': ['name should not be empty'],
    });
  });
});
