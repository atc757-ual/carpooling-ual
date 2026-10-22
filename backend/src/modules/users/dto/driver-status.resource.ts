import { ApiProperty } from '@nestjs/swagger';
import { DriverReadiness } from '../driver-readiness';

// Recurso TMF630 DriverStatus: qué le falta al conductor para publicar viajes
// (RF-21). Es una clase para que OpenAPI pueda describirlo
export class DriverStatusResource {
  @ApiProperty({ enum: ['DriverStatus'] })
  '@type': 'DriverStatus';

  @ApiProperty({
    description: 'Has accepted the responsible declaration (RF-21)',
  })
  hasLicenseDeclared: boolean;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    type: String,
    description: 'Date of the first declaration',
  })
  licenseDeclaredAt: string | null;

  @ApiProperty({ example: 1 })
  activeVehicles: number;

  @ApiProperty({
    description:
      'Can publish trips: declaration accepted and at least one vehicle',
  })
  isReady: boolean;
}

export function toDriverStatusResource(
  readiness: DriverReadiness,
): DriverStatusResource {
  return {
    '@type': 'DriverStatus',
    hasLicenseDeclared: readiness.hasLicenseDeclared,
    licenseDeclaredAt: readiness.licenseDeclaredAt?.toISOString() ?? null,
    activeVehicles: readiness.activeVehicles,
    isReady: readiness.isReady,
  };
}
