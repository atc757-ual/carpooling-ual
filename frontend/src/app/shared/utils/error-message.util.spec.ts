import { ApiError, NETWORK_ERROR } from '../../core/models/api-error.model';
import { getErrorMessage } from './error-message.util';

describe('getErrorMessage', () => {
  it('returns the message of a known code', () => {
    expect(getErrorMessage(new ApiError('INVALID_CREDENTIALS', 401))).toBe(
      'Correo o contraseña incorrectos.',
    );
  });

  it('explains a network error', () => {
    expect(getErrorMessage(new ApiError(NETWORK_ERROR, 0))).toContain('No hay conexión');
  });

  it('falls back to a generic message for an unknown code', () => {
    expect(getErrorMessage(new ApiError('SOMETHING_NEW', 409))).toBe(
      'Algo ha salido mal. Inténtalo de nuevo.',
    );
  });

  it('tells the driver which time overlaps', () => {
    const error = new ApiError('TRIP_OVERLAPS', 409, {
      message: 'The trip overlaps with a trip departing at 2026-11-03T07:15:00.000Z',
    });
    expect(getErrorMessage(error)).toContain('Ya tienes un viaje a esa hora');
    expect(getErrorMessage(error)).toContain('Elige otra hora.');
  });

  it('asks the driver to choose another day after the daily limit', () => {
    expect(getErrorMessage(new ApiError('DAILY_TRIP_LIMIT', 409))).toBe(
      'Ya tienes 4 viajes ese día. Elige otro día.',
    );
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
