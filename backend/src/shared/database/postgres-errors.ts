import { QueryFailedError } from 'typeorm';

// Código de PostgreSQL para "valor duplicado en una restricción UNIQUE"
const UNIQUE_VIOLATION = '23505';

// Indica si un error de la base de datos es una violación de la restricción
// UNIQUE indicada (p. ej. 'users_email_key': correo ya registrado).
// Comprobar la restricción concreta evita confundirla con otro duplicado.
export function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as {
    code?: string;
    constraint?: string;
  };
  return (
    driverError.code === UNIQUE_VIOLATION &&
    driverError.constraint === constraint
  );
}
