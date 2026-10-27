import { registerDecorator, ValidationOptions } from 'class-validator';

import { fitsPasswordByteLimit } from '../domain/password-policy';

export function PasswordByteLimit(
  options?: ValidationOptions,
): PropertyDecorator {
  return (target, property) =>
    registerDecorator({
      name: 'passwordByteLimit',
      target: target.constructor,
      propertyName: String(property),
      options,
      validator: { validate: fitsPasswordByteLimit },
    });
}
