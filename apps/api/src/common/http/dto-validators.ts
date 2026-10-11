import { ValidateBy, type ValidationOptions } from 'class-validator';

/**
 * A required, trimmed text field checked in one step, so a missing value reports only the
 * "required" message and a long one only the length message.
 */
export function IsRequiredText(
  maxLength: number,
  requiredMessage: string,
  tooLongMessage: string,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isRequiredText',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && value.length > 0 && value.length <= maxLength,
        defaultMessage: (args) =>
          typeof args?.value === 'string' && args.value.length > maxLength
            ? tooLongMessage
            : requiredMessage,
      },
    },
    options,
  );
}

/** A string accepted by `test`, reported with `message`. */
export function Matches(
  test: (value: string) => boolean,
  message: string,
  options?: ValidationOptions,
): PropertyDecorator {
  return ValidateBy(
    {
      name: 'matchesRule',
      validator: {
        validate: (value: unknown) => typeof value === 'string' && test(value),
        defaultMessage: () => message,
      },
    },
    options,
  );
}
