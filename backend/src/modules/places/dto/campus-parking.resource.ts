import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import { CampusParking } from '../entities/campus-parking.entity';

// Recurso TMF630 CampusParking. Es una clase para que OpenAPI pueda describirlo
export class CampusParkingResource {
  @ApiProperty({ enum: ['CampusParking'] })
  '@type': 'CampusParking';

  @ApiProperty({ example: 'p1' })
  id: string;

  @ApiProperty({ example: '/api/campus-parkings/p1' })
  href: string;

  @ApiProperty({ example: 'Parking P1' })
  name: string;

  @ApiProperty({
    type: GeoPointDto,
    example: { type: 'Point', coordinates: [-2.4045, 36.8322] },
  })
  location: GeoPointDto;
}

export function campusParkingHref(id: string): string {
  return `/${API_PREFIX}/campus-parkings/${id}`;
}

export function toCampusParkingResource(
  parking: CampusParking,
): CampusParkingResource {
  return {
    '@type': 'CampusParking',
    id: parking.id,
    href: campusParkingHref(parking.id),
    name: parking.name,
    location: {
      type: 'Point',
      coordinates: [
        parking.location.coordinates[0],
        parking.location.coordinates[1],
      ],
    },
  };
}
