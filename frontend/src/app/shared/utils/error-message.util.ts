import { translate } from '@jsverse/transloco';
import { ApiError, UNKNOWN_ERROR } from '../../core/models/api-error.model';

// El mensaje para el usuario de un código de error (docs/api/errors.md), en el
// idioma activo: `errors.<código>` del diccionario. Un código sin mensaje da el
// genérico; el error interno lleva la referencia para soporte (X-Request-Id)
export function getErrorMessage(error: ApiError): string {
  if (error.code === 'INTERNAL_ERROR') {
    const reference = error.requestId
      ? translate('errors.reference', { requestId: error.requestId })
      : '';
    return translate('errors.INTERNAL_ERROR', { reference });
  }
  const key = `errors.${error.code}`;
  const message = translate(key);
  return message === key ? translate(`errors.${UNKNOWN_ERROR}`) : message;
}
