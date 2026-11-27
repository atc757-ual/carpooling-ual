import { TranslocoService } from '@jsverse/transloco';
import { vi } from 'vitest';
import { ApiError } from '../../core/models/api-error.model';
import { getAuthErrorMessage } from './auth-error-message.util';

describe('getAuthErrorMessage', () => {
  const translate = vi.fn((key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
  );
  const transloco = { translate } as unknown as TranslocoService;

  beforeEach(() => {
    translate.mockClear();
  });

  it('formats INTERNAL_ERROR with a requestId reference when available', () => {
    const error = new ApiError('INTERNAL_ERROR', 500, { requestId: 'req-42' });
    const msg = getAuthErrorMessage(error, transloco);

    expect(translate).toHaveBeenCalledWith('auth.errors.reference', { requestId: 'req-42' });
    expect(msg).toContain('auth.errors.internal');
  });

  it('formats INTERNAL_ERROR with an empty reference when requestId is missing', () => {
    const error = new ApiError('INTERNAL_ERROR', 500);
    const msg = getAuthErrorMessage(error, transloco);

    expect(translate).toHaveBeenCalledWith('auth.errors.internal', { reference: '' });
    expect(msg).toContain('auth.errors.internal');
  });

  it('maps known error codes to their translation keys and falls back to generic for unknown codes', () => {
    expect(getAuthErrorMessage(new ApiError('INVALID_CREDENTIALS', 401), transloco)).toBe(
      'auth.errors.invalidCredentials',
    );
    expect(getAuthErrorMessage(new ApiError('SOME_UNMAPPED_CODE', 400), transloco)).toBe(
      'auth.errors.generic',
    );
  });

  it('includes the remaining OTP lock time in the translated message', () => {
    const error = new ApiError('OTP_SEND_RATE_LIMITED', 429, { retryAfterSeconds: 75 });

    expect(getAuthErrorMessage(error, transloco)).toBe(
      'errors.OTP_SEND_RATE_LIMITED:{"time":"01:15"}',
    );
  });
});
