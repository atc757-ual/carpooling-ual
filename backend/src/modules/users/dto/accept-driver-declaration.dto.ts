import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, Matches } from 'class-validator';

// Cuerpo de PUT /api/users/me/driver-declaration: la versión que leyó el
// conductor (si no se indica, la vigente)
export class AcceptDriverDeclarationDto {
  @ApiPropertyOptional({
    example: '1.0',
    description:
      'The version the driver read; it must be the current one (LEGAL_DOCUMENT_OUTDATED otherwise)',
  })
  @IsOptional()
  @Matches(/^\d+\.\d+$/)
  version?: string;
}
