import { applyDecorators, HttpStatus } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';
import { TmfError, TmfValidationError } from './tmf-error';

// Errores posibles de un endpoint: status HTTP → códigos TMF que puede dar
export type ApiErrors = Partial<Record<HttpStatus, string[]>>;

// Documenta en OpenAPI las respuestas de error de un endpoint con el formato
// TMF630, indicando los códigos de cada status. Todos los endpoints pueden
// responder además 500 INTERNAL_ERROR.
//   @ApiErrorResponses({ 409: ['EMAIL_ALREADY_REGISTERED'] })
export function ApiErrorResponses(errors: ApiErrors): MethodDecorator {
  const responses = Object.entries({
    ...errors,
    [HttpStatus.INTERNAL_SERVER_ERROR]: ['INTERNAL_ERROR'],
  }).map(([status, codes = []]) =>
    ApiResponse({
      status: Number(status),
      description: `TMF630 error: ${codes.join(', ')}`,
      schema: errorSchema(codes),
    }),
  );
  return applyDecorators(
    ApiExtraModels(TmfError, TmfValidationError),
    ...responses,
  );
}

// VALIDATION_FAILED usa ValidationError; el resto, Error. Si en un mismo
// status caben los dos (p. ej. 400), el cuerpo puede ser uno u otro
function errorSchema(codes: string[]): object {
  const validationRef = { $ref: getSchemaPath(TmfValidationError) };
  const errorRef = { $ref: getSchemaPath(TmfError) };
  if (!codes.includes(VALIDATION_FAILED)) {
    return errorRef;
  }
  return codes.length === 1
    ? validationRef
    : { oneOf: [validationRef, errorRef] };
}

const VALIDATION_FAILED = 'VALIDATION_FAILED';
