import type { LoggerService } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER } from './request-id.middleware';

// Una línea de log por petición (observabilidad, RNF-01 y RNF-07): con ella el
// panel de Grafana cuenta peticiones y errores y calcula el p95 por ruta
export interface RequestLogEntry {
  method: string;
  // El patrón de la ruta (/api/trips/:id), no la URL: sin identificadores ni
  // parámetros de búsqueda (pocos valores distintos y sin datos personales)
  route: string;
  status: number;
  durationMs: number;
  requestId: string | null;
}

export const UNMATCHED_ROUTE = 'unmatched';

export function routeOf(request: Request): string {
  const route = request.route as { path?: unknown } | undefined;
  return typeof route?.path === 'string'
    ? `${request.baseUrl}${route.path}`
    : UNMATCHED_ROUTE;
}

// Escribe la línea al terminar la respuesta, con el contexto HTTP
export function createRequestLogMiddleware(
  logger: LoggerService,
): (request: Request, response: Response, next: NextFunction) => void {
  return (request, response, next) => {
    const startedAt = process.hrtime.bigint();
    response.on('finish', () => {
      const elapsedNs = process.hrtime.bigint() - startedAt;
      const entry: RequestLogEntry = {
        method: request.method,
        route: routeOf(request),
        status: response.statusCode,
        durationMs: Math.round(Number(elapsedNs) / 1e4) / 100,
        requestId: response.getHeader(REQUEST_ID_HEADER)?.toString() ?? null,
      };
      logger.log(entry, 'HTTP');
    });
    next();
  };
}
