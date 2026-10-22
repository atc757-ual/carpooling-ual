import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { Page } from './page';

export const TOTAL_COUNT_HEADER = 'X-Total-Count';
export const RESULT_COUNT_HEADER = 'X-Result-Count';

// Cabeceras de las listas (TMF630): cuántos elementos hay en total y cuántos
// van en esta respuesta. El cuerpo es solo el array de recursos
export function setPaginationHeaders(
  response: Response,
  page: Page<unknown>,
): void {
  response.setHeader(TOTAL_COUNT_HEADER, String(page.total));
  response.setHeader(RESULT_COUNT_HEADER, String(page.items.length));
}

// Documenta en OpenAPI una respuesta de lista: array del recurso + cabeceras
export function ApiPaginatedResponse(resource: Type): MethodDecorator {
  return applyDecorators(
    ApiOkResponse({
      type: [resource],
      headers: {
        [TOTAL_COUNT_HEADER]: {
          description: 'Total number of items',
          schema: { type: 'integer' },
        },
        [RESULT_COUNT_HEADER]: {
          description: 'Number of items in this response',
          schema: { type: 'integer' },
        },
      },
    }),
  );
}
