import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

/** Field path → list of human-readable constraint messages. */
export type FieldErrors = Record<string, string[]>;

export class ValidationFailedException extends BadRequestException {
  constructor(readonly fields: FieldErrors) {
    super('Validation failed');
  }

  static fromValidationErrors(errors: ValidationError[]): ValidationFailedException {
    const fields: FieldErrors = {};
    const visit = (error: ValidationError, parentPath: string): void => {
      const path = parentPath ? `${parentPath}.${error.property}` : error.property;
      if (error.constraints) {
        fields[path] = Object.values(error.constraints);
      }
      for (const child of error.children ?? []) visit(child, path);
    };
    for (const error of errors) visit(error, '');
    return new ValidationFailedException(fields);
  }
}
