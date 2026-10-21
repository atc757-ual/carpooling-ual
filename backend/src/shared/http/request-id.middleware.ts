import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'X-Request-Id';

// Solo letras, números, "_", "." y "-", hasta 128 caracteres: impide que un
// cliente meta saltos de línea u otra basura en los logs a través de la cabecera
const VALID_REQUEST_ID = /^[\w.-]{1,128}$/;

// Identificador de cada petición (TMF630): reutiliza el del cliente si es
// válido o genera un UUID, y lo devuelve en la cabecera X-Request-Id. El mismo
// id aparece en el log de los errores, para poder encontrarlos
export function requestIdMiddleware(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const clientRequestId = request.get(REQUEST_ID_HEADER);
  const requestId =
    clientRequestId !== undefined && VALID_REQUEST_ID.test(clientRequestId)
      ? clientRequestId
      : randomUUID();

  response.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
