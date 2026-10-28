import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import { Vehicle, VEHICLE_STATUSES } from '../entities/vehicle.entity';
import type { VehicleStatus } from '../entities/vehicle.entity';

// Recurso TMF630 Vehicle. Es una clase para que OpenAPI pueda describirlo
export class VehicleResource {
  @ApiProperty({ enum: ['Vehicle'] })
  '@type': 'Vehicle';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/vehicles/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  })
  href: string;

  @ApiProperty({ example: '1234BCD' })
  plate: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Seat Ibiza',
    description: 'Make and model; null if it was registered without it',
  })
  model: string | null;

  @ApiProperty({ minimum: 1, maximum: 8, example: 4 })
  capacity: number;

  @ApiProperty({ enum: VEHICLE_STATUSES })
  status: VehicleStatus;
}

export function vehicleHref(id: string): string {
  return `/${API_PREFIX}/vehicles/${id}`;
}

export function toVehicleResource(vehicle: Vehicle): VehicleResource {
  return {
    '@type': 'Vehicle',
    id: vehicle.id,
    href: vehicleHref(vehicle.id),
    plate: vehicle.plate,
    model: vehicle.model,
    capacity: vehicle.capacity,
    status: vehicle.status,
  };
}
