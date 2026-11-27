import { TranslocoService } from '@jsverse/transloco';
import { TestBed } from '@angular/core/testing';
import { initAppTranslations } from '../../core/i18n/testing-transloco';
import { ApiError, NETWORK_ERROR } from '../../core/models/api-error.model';
import { getErrorMessage } from './error-message.util';

describe('getErrorMessage', () => {
  beforeEach(() => initAppTranslations());

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

  it('formats the remaining OTP lock time', () => {
    expect(
      getErrorMessage(new ApiError('OTP_SEND_RATE_LIMITED', 429, { retryAfterSeconds: 75 })),
    ).toContain('01:15');
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

  describe('in English', () => {
    beforeEach(() => TestBed.inject(TranslocoService).setActiveLang('en'));

    it('translates known error codes', () => {
      expect(getErrorMessage(new ApiError('INVALID_CREDENTIALS', 401))).toBe(
        'Incorrect email or password.',
      );
    });

    it('translates internal server errors with their reference', () => {
      const error = new ApiError('INTERNAL_ERROR', 500, { requestId: 'req-99' });
      expect(getErrorMessage(error)).toBe(
        'A server error occurred (reference: req-99). Please try again.',
      );
    });

    it('falls back to the generic message when the code has none', () => {
      expect(getErrorMessage(new ApiError('UNMAPPED_CODE', 400))).toBe(
        'Something went wrong. Please try again.',
      );
    });
  });
});
