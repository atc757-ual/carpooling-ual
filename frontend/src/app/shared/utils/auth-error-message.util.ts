import { TranslocoService } from '@jsverse/transloco';
import { ApiError } from '../../core/models/api-error.model';

const ERROR_TRANSLATION_KEYS: Readonly<Record<string, string>> = {
  NETWORK_ERROR: 'auth.errors.network',
  UNKNOWN_ERROR: 'auth.errors.generic',
  VALIDATION_FAILED: 'auth.errors.validation',
  SERVICE_UNAVAILABLE: 'auth.errors.unavailable',
  INVALID_CREDENTIALS: 'auth.errors.invalidCredentials',
  INVALID_VERIFICATION_CODE: 'auth.errors.invalidCode',
  PASSWORD_UNCHANGED: 'auth.errors.passwordUnchanged',
  TOO_MANY_ATTEMPTS: 'auth.errors.tooManyAttempts',
  EMAIL_ALREADY_REGISTERED: 'auth.errors.emailRegistered',
  EMAIL_DOMAIN_NOT_ALLOWED: 'auth.errors.emailDomain',
};

export function getAuthErrorMessage(error: ApiError, transloco: TranslocoService): string {
  if (error.code === 'INTERNAL_ERROR') {
    const reference = error.requestId
      ? transloco.translate('auth.errors.reference', { requestId: error.requestId })
      : '';
    return transloco.translate('auth.errors.internal', { reference });
  }

  const key = ERROR_TRANSLATION_KEYS[error.code] ?? 'auth.errors.generic';
  return transloco.translate(key);
}
