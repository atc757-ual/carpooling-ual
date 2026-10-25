import { ApiError, NETWORK_ERROR, UNKNOWN_ERROR } from '../../core/models/api-error.model';

// Mensajes para el usuario de cada código de error (docs/api/errors.md). Se
// añaden los de cada área cuando se haga su pantalla.
const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [NETWORK_ERROR]: 'No hay conexión. Comprueba tu red e inténtalo de nuevo.',
  [UNKNOWN_ERROR]: 'Algo ha salido mal. Inténtalo de nuevo.',
  VALIDATION_FAILED: 'Revisa los datos del formulario.',
  NOT_FOUND: 'No hemos encontrado lo que buscas.',
  SERVICE_UNAVAILABLE: 'El servicio no está disponible ahora mismo. Inténtalo más tarde.',
  INVALID_CREDENTIALS: 'Correo o contraseña incorrectos.',
  EMAIL_NOT_VERIFIED: 'Tienes que verificar tu correo antes de entrar.',
  INVALID_VERIFICATION_CODE: 'Ese código no es válido. Revisa los 6 dígitos o pide uno nuevo.',
  TOO_MANY_ATTEMPTS: 'Has fallado demasiadas veces. Pide un código nuevo.',
  EMAIL_ALREADY_REGISTERED: 'Ya hay una cuenta con este correo.',
  EMAIL_DOMAIN_NOT_ALLOWED: 'Usa tu correo de la Universidad de Almería.',
  INVALID_ACCESS_TOKEN: 'Tu sesión no es válida. Vuelve a iniciar sesión.',
  ACCESS_TOKEN_EXPIRED: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  INVALID_REFRESH_TOKEN: 'Tu sesión ha caducado. Vuelve a iniciar sesión.',
  PROFILE_REQUIRED: 'Tu perfil no permite hacer esta acción.',
};

export function getErrorMessage(error: ApiError): string {
  if (error.code === 'INTERNAL_ERROR') {
    const reference = error.requestId ? ` (referencia: ${error.requestId})` : '';
    return `Ha ocurrido un error en el servidor${reference}. Inténtalo de nuevo.`;
  }
  return ERROR_MESSAGES[error.code] ?? ERROR_MESSAGES[UNKNOWN_ERROR];
}
