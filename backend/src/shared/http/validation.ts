import { ParseUUIDPipe, PipeTransform, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { TmfFieldError } from './tmf-error';

// Datos de entrada no válidos (cuerpo, parámetros…). Es un error de la capa
// API, no de negocio: lo lanza el ValidationPipe antes de llegar al service
export class RequestValidationError extends Error {
  constructor(readonly fields: TmfFieldError[]) {
    super('The request has invalid fields');
    this.name = 'RequestValidationError';
  }
}

// ValidationPipe global: comprueba cada DTO con sus decoradores de
// class-validator y devuelve todos los campos que fallan de una vez
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    // Rechaza los campos que el DTO no declara (p. ej. "isAdmin": true)
    whitelist: true,
    forbidNonWhitelisted: true,
    // Convierte el JSON en una instancia del DTO (aplica sus @Transform)
    transform: true,
    exceptionFactory: (errors) =>
      new RequestValidationError(toFieldErrors(errors)),
  });
}

// Valida que un parámetro de la ruta sea un UUID (p. ej. /users/:id). Si no
// lo es, responde 400 VALIDATION_FAILED como el resto de la validación, en vez
// del error genérico de NestJS
export function uuidParam(field: string): ParseUUIDPipe {
  return new ParseUUIDPipe({
    exceptionFactory: () =>
      new RequestValidationError([
        { field, reason: `${field} must be a UUID` },
      ]),
  });
}

// Valida que un parámetro de la ruta sea uno de los valores permitidos (p. ej.
// /users/:id/profiles/:profile). Si no, 400 VALIDATION_FAILED
export function allowedParam<T extends string>(
  field: string,
  allowed: readonly T[],
): PipeTransform<string, T> {
  return {
    transform(value: string): T {
      const match = allowed.find((option) => option === value);
      if (match === undefined) {
        throw new RequestValidationError([
          { field, reason: `${field} must be one of: ${allowed.join(', ')}` },
        ]);
      }
      return match;
    },
  };
}

// Aplana los errores de class-validator: un elemento por regla incumplida,
// con la ruta completa del campo (p. ej. "address.city")
export function toFieldErrors(
  errors: ValidationError[],
  parentPath = '',
): TmfFieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const ownErrors = Object.values(error.constraints ?? {}).map((reason) => ({
      field,
      reason,
    }));
    return [...ownErrors, ...toFieldErrors(error.children ?? [], field)];
  });
}
