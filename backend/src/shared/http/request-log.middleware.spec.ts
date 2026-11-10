import { EventEmitter } from 'node:events';
import type { LoggerService } from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  createRequestLogMiddleware,
  RequestLogEntry,
  UNMATCHED_ROUTE,
} from './request-log.middleware';

// Respuesta mínima: emite «finish» y devuelve el estado y la cabecera
function fakeResponse(status: number, requestId?: string): Response {
  return Object.assign(new EventEmitter(), {
    statusCode: status,
    getHeader: (name: string) =>
      name === 'X-Request-Id' ? requestId : undefined,
  }) as unknown as Response;
}

describe('request log middleware', () => {
  const log = jest.fn();
  const logger = { log } as unknown as LoggerService;
  const middleware = createRequestLogMiddleware(logger);

  beforeEach(() => log.mockReset());

  function run(request: Partial<Request>, response: Response): void {
    const next = jest.fn();
    middleware(request as Request, response, next);
    expect(next).toHaveBeenCalled();
  }

  it('logs the route pattern, status, duration and request id when the response ends', () => {
    const response = fakeResponse(200, 'req-1');
    run(
      {
        method: 'GET',
        baseUrl: '',
        route: { path: '/api/trips/:id' },
      } as Partial<Request>,
      response,
    );
    expect(log).not.toHaveBeenCalled();

    response.emit('finish');

    const [entry, context] = log.mock.calls[0] as [RequestLogEntry, string];
    expect(context).toBe('HTTP');
    expect(entry).toMatchObject({
      method: 'GET',
      route: '/api/trips/:id',
      status: 200,
      requestId: 'req-1',
    });
    expect(entry.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('does not log the URL of a request without a route', () => {
    const response = fakeResponse(404);
    run({ method: 'GET', baseUrl: '' }, response);

    response.emit('finish');

    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        route: UNMATCHED_ROUTE,
        status: 404,
        requestId: null,
      }),
      'HTTP',
    );
  });
});
