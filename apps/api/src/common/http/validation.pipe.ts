import { ValidationPipe } from '@nestjs/common';
import { ValidationFailedException } from '../errors/validation-failed.exception.js';

/**
 * Global DTO validation (API Design §22): strip and reject unknown properties,
 * transform payloads into DTO instances, and report field errors in the standard contract.
 */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    stopAtFirstError: false,
    exceptionFactory: (errors) => ValidationFailedException.fromValidationErrors(errors),
  });
}
