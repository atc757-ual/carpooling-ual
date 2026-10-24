import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { BusinessError, BusinessErrorKind } from '../errors/business-error';
import { REQUEST_ID_HEADER } from './request-id.middleware';
import { TmfError, TmfValidationError } from './tmf-error';
import { RequestValidationError } from './validation';

const STATUS_BY_KIND: Record<BusinessErrorKind, HttpStatus> = {
  invalid: HttpStatus.BAD_REQUEST,
  unauthorized: HttpStatus.UNAUTHORIZED,
  forbidden: HttpStatus.FORBIDDEN,
  not_found: HttpStatus.NOT_FOUND,
  conflict: HttpStatus.CONFLICT,
  too_many_requests: HttpStatus.TOO_MANY_REQUESTS,
};

const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
const VALIDATION_FAILED_CODE = 'VALIDATION_FAILED';

// Filtro global de la capa API: convierte CUALQUIER error en el objeto Error
// de TMF630. Los services lanzan errores de negocio y no saben nada de HTTP;
// la traducción se hace solo aquí
@Catch()
export class TmfExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(TmfExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = String(response.getHeader(REQUEST_ID_HEADER) ?? '');
    const error = this.toTmfError(exception, requestId);

    response.status(Number(error.status)).json(error);
  }

  private toTmfError(
    exception: unknown,
    requestId: string,
  ): TmfError | TmfValidationError {
    // Campos no válidos detectados por el ValidationPipe
    if (exception instanceof RequestValidationError) {
      return {
        ...buildTmfError(
          VALIDATION_FAILED_CODE,
          HttpStatus.BAD_REQUEST,
          exception.message,
        ),
        '@type': 'ValidationError',
        '@baseType': 'Error',
        fields: exception.fields,
      };
    }

    // Errores de negocio de los módulos (EmailAlreadyRegisteredError…)
    if (exception instanceof BusinessError) {
      return buildTmfError(
        exception.code,
        STATUS_BY_KIND[exception.kind],
        exception.message,
      );
    }

    // Errores propios de NestJS: ruta inexistente (404), 503 del health…
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code = HttpStatus[status] ?? 'HTTP_ERROR';
      return buildTmfError(code, status, exception.message);
    }

    // Cualquier otro error es un fallo inesperado: el detalle va SOLO al log
    // (con el X-Request-Id) y el cliente recibe un 500 sin datos internos
    this.logger.error(
      `Unexpected error [${REQUEST_ID_HEADER}: ${requestId}]`,
      exception instanceof Error ? exception.stack : String(exception),
    );
    return buildTmfError(
      INTERNAL_ERROR_CODE,
      HttpStatus.INTERNAL_SERVER_ERROR,
      `Unexpected error. Reference: ${requestId}`,
    );
  }
}

function buildTmfError(
  code: string,
  status: number,
  message: string,
): TmfError {
  return {
    '@type': 'Error',
    code,
    reason: toReason(code),
    message,
    status: String(status),
  };
}

// "EMAIL_ALREADY_REGISTERED" → "Email already registered"
function toReason(code: string): string {
  const words = code.toLowerCase().replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}
