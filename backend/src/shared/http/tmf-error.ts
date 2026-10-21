import { ApiProperty } from '@nestjs/swagger';

// Cuerpo de una respuesta de error según TMF630 (TM Forum REST API Design
// Guidelines). status va como texto, tal como lo define la norma.
// Son clases (y no interfaces) para que OpenAPI pueda describirlas
export class TmfError {
  @ApiProperty({ enum: ['Error'] })
  '@type': 'Error';

  @ApiProperty({
    description: 'Stable code; see docs/api/errors.md',
    example: 'EMAIL_ALREADY_REGISTERED',
  })
  code: string;

  @ApiProperty({ example: 'Email already registered' })
  reason: string;

  @ApiProperty({ example: 'The email ana@ual.es is already registered' })
  message: string;

  @ApiProperty({ description: 'HTTP status as text', example: '409' })
  status: string;
}

export class TmfFieldError {
  @ApiProperty({ example: 'email' })
  field: string;

  @ApiProperty({ example: 'email must be an email' })
  reason: string;
}

// Extensión de Error para los datos de entrada no válidos: TMF630 permite
// tipos derivados indicando el tipo base en @baseType
export class TmfValidationError {
  @ApiProperty({ enum: ['ValidationError'] })
  '@type': 'ValidationError';

  @ApiProperty({ enum: ['Error'] })
  '@baseType': 'Error';

  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code: string;

  @ApiProperty({ example: 'Validation failed' })
  reason: string;

  @ApiProperty({ example: 'The request has invalid fields' })
  message: string;

  @ApiProperty({ example: '400' })
  status: string;

  @ApiProperty({ type: [TmfFieldError] })
  fields: TmfFieldError[];
}
