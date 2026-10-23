import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { ApiError, NETWORK_ERROR, UNKNOWN_ERROR } from './api-error.model';

describe('ApiError.fromHttpError', () => {
  it('reads the TMF630 error code, status, fields and request id', () => {
    const response = new HttpErrorResponse({
      status: 400,
      headers: new HttpHeaders({ 'X-Request-Id': 'req-1' }),
      error: {
        '@type': 'ValidationError',
        code: 'VALIDATION_FAILED',
        status: '400',
        fields: [{ field: 'email', reason: 'email must be an email' }],
      },
    });

    const error = ApiError.fromHttpError(response);

    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.status).toBe(400);
    expect(error.fields).toEqual([{ field: 'email', reason: 'email must be an email' }]);
    expect(error.requestId).toBe('req-1');
  });

  it('has no fields when the error does not bring them', () => {
    const response = new HttpErrorResponse({ status: 401, error: { code: 'INVALID_CREDENTIALS' } });

    expect(ApiError.fromHttpError(response).fields).toEqual([]);
  });

  it('treats a request that never reached the server as a network error', () => {
    const response = new HttpErrorResponse({ status: 0, error: new ProgressEvent('error') });

    const error = ApiError.fromHttpError(response);

    expect(error.code).toBe(NETWORK_ERROR);
    expect(error.status).toBe(0);
  });

  it('keeps the status of a response that is not a TMF630 error', () => {
    const response = new HttpErrorResponse({ status: 502, error: '<html>Bad Gateway</html>' });

    const error = ApiError.fromHttpError(response);

    expect(error.code).toBe(UNKNOWN_ERROR);
    expect(error.status).toBe(502);
  });

  it('returns the same error when it is already an ApiError', () => {
    const error = new ApiError('INVALID_REFRESH_TOKEN', 401);

    expect(ApiError.fromHttpError(error)).toBe(error);
  });

  it('turns anything else into an unknown error', () => {
    expect(ApiError.fromHttpError(new Error('boom')).code).toBe(UNKNOWN_ERROR);
  });
});
