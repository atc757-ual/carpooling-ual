import {
  ArgumentsHost,
  HttpException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { BusinessError, BusinessErrorKind } from '../errors/business-error';
import { TmfExceptionFilter } from './tmf-exception.filter';
import { RequestValidationError } from './validation';

class SampleBusinessError extends BusinessError {
  constructor(kind: BusinessErrorKind) {
    super('SAMPLE_BUSINESS_RULE', kind, 'Sample detail');
  }
}

describe('TmfExceptionFilter', () => {
  const filter = new TmfExceptionFilter();
  const response = {
    getHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  let loggerError: jest.SpyInstance;

  beforeEach(() => {
    jest.resetAllMocks();
    response.getHeader.mockReturnValue('request-1');
    response.status.mockReturnValue(response);
    loggerError = jest.spyOn(Logger.prototype, 'error').mockImplementation();
  });

  function sentBody(): unknown {
    return (response.json.mock.calls[0] as [unknown])[0];
  }

  it.each([
    ['invalid', 400],
    ['unauthorized', 401],
    ['forbidden', 403],
    ['not_found', 404],
    ['conflict', 409],
  ] as const)('maps a "%s" business error to HTTP %i', (kind, httpStatus) => {
    filter.catch(new SampleBusinessError(kind), host);

    expect(response.status).toHaveBeenCalledWith(httpStatus);
    expect(sentBody()).toEqual({
      '@type': 'Error',
      code: 'SAMPLE_BUSINESS_RULE',
      reason: 'Sample business rule',
      message: 'Sample detail',
      status: String(httpStatus),
    });
  });

  it('maps invalid fields to a TMF ValidationError with the field list', () => {
    const fields = [{ field: 'email', reason: 'email must be an email' }];

    filter.catch(new RequestValidationError(fields), host);

    expect(response.status).toHaveBeenCalledWith(400);
    expect(sentBody()).toEqual({
      '@type': 'ValidationError',
      '@baseType': 'Error',
      code: 'VALIDATION_FAILED',
      reason: 'Validation failed',
      message: 'The request has invalid fields',
      status: '400',
      fields,
    });
  });

  it('maps a NestJS HTTP exception using its status name as code', () => {
    filter.catch(new NotFoundException('Cannot GET /api/nothing'), host);

    expect(response.status).toHaveBeenCalledWith(404);
    expect(sentBody()).toEqual({
      '@type': 'Error',
      code: 'NOT_FOUND',
      reason: 'Not found',
      message: 'Cannot GET /api/nothing',
      status: '404',
    });
  });

  it('maps a 503 to SERVICE_UNAVAILABLE', () => {
    filter.catch(new ServiceUnavailableException('Database unavailable'), host);

    expect(sentBody()).toMatchObject({
      code: 'SERVICE_UNAVAILABLE',
      status: '503',
    });
  });

  it('uses HTTP_ERROR for a status without a standard name', () => {
    filter.catch(new HttpException('Client closed request', 499), host);

    expect(sentBody()).toMatchObject({ code: 'HTTP_ERROR', status: '499' });
  });

  it('still answers when the response has no X-Request-Id', () => {
    response.getHeader.mockReturnValue(undefined);

    filter.catch(new Error('boom'), host);

    expect(sentBody()).toMatchObject({
      message: 'Unexpected error. Reference: ',
    });
  });

  it('hides the details of an unexpected error and logs them', () => {
    filter.catch(new Error('password authentication failed for user'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(sentBody()).toEqual({
      '@type': 'Error',
      code: 'INTERNAL_ERROR',
      reason: 'Internal error',
      message: 'Unexpected error. Reference: request-1',
      status: '500',
    });
    expect(JSON.stringify(sentBody())).not.toContain('password');
    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining('request-1'),
      expect.stringContaining('password authentication failed'),
    );
  });

  it('also handles thrown values that are not Error objects', () => {
    filter.catch('something odd', host);

    expect(response.status).toHaveBeenCalledWith(500);
    expect(loggerError).toHaveBeenCalledWith(
      expect.any(String),
      'something odd',
    );
  });
});
