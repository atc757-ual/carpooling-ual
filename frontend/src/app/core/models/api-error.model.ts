import { HttpErrorResponse } from '@angular/common/http';

// Errores de la API en formato TMF630 ({ code, reason, message, status, fields })
// convertidos en un único tipo para toda la app. Los códigos de la API están en
// docs/api/errors.md; NETWORK_ERROR y UNKNOWN_ERROR son solo del frontend.

export const NETWORK_ERROR = 'NETWORK_ERROR';
export const UNKNOWN_ERROR = 'UNKNOWN_ERROR';

export interface ApiFieldError {
  field: string;
  reason: string;
}

interface TmfErrorBody {
  code: string;
  message?: string;
  fields?: ApiFieldError[];
}

function isTmfErrorBody(body: unknown): body is TmfErrorBody {
  return typeof body === 'object' && body !== null && typeof (body as TmfErrorBody).code === 'string';
}

export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    readonly details: { fields?: ApiFieldError[]; requestId?: string } = {},
  ) {
    super(code);
    this.name = 'ApiError';
  }

  get fields(): ApiFieldError[] {
    return this.details.fields ?? [];
  }

  // Referencia del error para soporte (cabecera X-Request-Id de la respuesta)
  get requestId(): string | undefined {
    return this.details.requestId;
  }

  static fromHttpError(error: unknown): ApiError {
    if (error instanceof ApiError) {
      return error;
    }
    if (!(error instanceof HttpErrorResponse)) {
      return new ApiError(UNKNOWN_ERROR, 0);
    }
    // status 0: la petición no llegó al servidor (sin conexión, CORS, timeout)
    if (error.status === 0) {
      return new ApiError(NETWORK_ERROR, 0);
    }
    const requestId = error.headers?.get('X-Request-Id') ?? undefined;
    if (isTmfErrorBody(error.error)) {
      return new ApiError(error.error.code, error.status, { fields: error.error.fields, requestId });
    }
    return new ApiError(UNKNOWN_ERROR, error.status, { requestId });
  }
}
