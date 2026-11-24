import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

// Hasta los viajes que caben en un mes con el máximo diario (4 × 31)
export const MAX_TRIPS_PER_VEHICLE_CHANGE = 124;

export class ChangeTripsVehicleDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    maxItems: MAX_TRIPS_PER_VEHICLE_CHANGE,
    description:
      'Trips of the driver, published or confirmed, that move to the vehicle',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_TRIPS_PER_VEHICLE_CHANGE)
  @IsUUID('all', { each: true })
  tripIds!: string[];

  @ApiProperty({
    format: 'uuid',
    description:
      'Active vehicle of the driver, with its declaration up to date',
  })
  @IsUUID()
  vehicleId!: string;
}
