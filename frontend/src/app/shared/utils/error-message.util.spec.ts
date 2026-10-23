import { ApiError, NETWORK_ERROR } from '../../core/models/api-error.model';
import { getErrorMessage } from './error-message.util';

describe('getErrorMessage', () => {
  it('returns the message of a known code', () => {
    expect(getErrorMessage(new ApiError('INVALID_CREDENTIALS', 401))).toBe('Correo o contraseña incorrectos.');
  });

  it('explains a network error', () => {
    expect(getErrorMessage(new ApiError(NETWORK_ERROR, 0))).toContain('No hay conexión');
  });

  it('falls back to a generic message for an unknown code', () => {
    expect(getErrorMessage(new ApiError('SOMETHING_NEW', 409))).toBe('Algo ha salido mal. Inténtalo de nuevo.');
  });

  it('includes the reference of a server error so it can be reported', () => {
    const error = new ApiError('INTERNAL_ERROR', 500, { requestId: 'req-42' });

    expect(getErrorMessage(error)).toContain('referencia: req-42');
  });

  it('describes a server error without a reference', () => {
    expect(getErrorMessage(new ApiError('INTERNAL_ERROR', 500))).toBe(
      'Ha ocurrido un error en el servidor. Inténtalo de nuevo.',
    );
  });
});
