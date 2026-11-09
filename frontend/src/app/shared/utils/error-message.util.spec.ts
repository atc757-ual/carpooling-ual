import { TranslocoService } from '@jsverse/transloco';
import { vi } from 'vitest';
import { ApiError, NETWORK_ERROR } from '../../core/models/api-error.model';
import { getErrorMessage } from './error-message.util';

describe('getErrorMessage', () => {
  it('returns the message of a known code', () => {
    expect(getErrorMessage(new ApiError('INVALID_CREDENTIALS', 401))).toBe(
      'Correo o contraseña incorrectos.',
    );
  });

  it('explains the boarding errors of the live trip instead of a generic message', () => {
    expect(getErrorMessage(new ApiError('INVALID_BOARD_CODE', 400))).toContain('no coincide');
    expect(getErrorMessage(new ApiError('ALREADY_BOARDED', 409))).toContain('ya está validado');
    expect(getErrorMessage(new ApiError('PICKUP_GRACE_PERIOD_ACTIVE', 400))).toContain('5 minutos');
  });

  it('explains a network error', () => {
    expect(getErrorMessage(new ApiError(NETWORK_ERROR, 0))).toContain('No hay conexión');
  });

  it('falls back to a generic message for an unknown code', () => {
    expect(getErrorMessage(new ApiError('SOMETHING_NEW', 409))).toBe(
      'Algo ha salido mal. Inténtalo de nuevo.',
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

  describe('with TranslocoService', () => {
    const transloco = {
      translate: vi.fn((key: string, params?: Record<string, unknown>) => {
        if (key === 'errors.reference') return ` (reference: ${params?.['requestId']})`;
        if (key === 'errors.INTERNAL_ERROR')
          return `A server error occurred${params?.['reference']}. Please try again.`;
        if (key === 'errors.INVALID_CREDENTIALS') return 'Incorrect email or password.';
        if (key === 'errors.UNKNOWN_ERROR') return 'Something went wrong. Please try again.';
        return key;
      }),
    } as unknown as TranslocoService;

    it('translates known error codes into English', () => {
      expect(getErrorMessage(new ApiError('INVALID_CREDENTIALS', 401), transloco)).toBe(
        'Incorrect email or password.',
      );
    });

    it('translates internal server errors with requestId into English', () => {
      const error = new ApiError('INTERNAL_ERROR', 500, { requestId: 'req-99' });
      expect(getErrorMessage(error, transloco)).toBe(
        'A server error occurred (reference: req-99). Please try again.',
      );
    });

    it('falls back to UNKNOWN_ERROR translation when key is missing', () => {
      expect(getErrorMessage(new ApiError('UNMAPPED_CODE', 400), transloco)).toBe(
        'Something went wrong. Please try again.',
      );
    });
  });
});
