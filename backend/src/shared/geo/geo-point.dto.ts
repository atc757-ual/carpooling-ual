import { ApiProperty } from '@nestjs/swagger';
import { IsIn, ValidateBy } from 'class-validator';

// [longitud, latitud] dentro de sus rangos válidos. Ojo: no detecta un punto
// con el orden invertido si los dos valores caben en ambos rangos (p. ej.
// Almería al revés, [36.8, -2.4], es un punto válido en otro lugar del mundo)
function IsLongitudeLatitude(): PropertyDecorator {
  return ValidateBy({
    name: 'isLongitudeLatitude',
    validator: {
      validate: (value: unknown): boolean =>
        Array.isArray(value) &&
        value.length === 2 &&
        value.every((n) => typeof n === 'number' && Number.isFinite(n)) &&
        Math.abs(value[0] as number) <= 180 &&
        Math.abs(value[1] as number) <= 90,
      defaultMessage: () =>
        'coordinates must be [longitude, latitude] (longitude -180..180, latitude -90..90)',
    },
  });
}

// Punto GeoJSON (RFC 7946), el formato de todas las ubicaciones de la API:
// { "type": "Point", "coordinates": [longitud, latitud] }
export class GeoPointDto {
  @ApiProperty({ enum: ['Point'] })
  @IsIn(['Point'])
  type!: 'Point';

  @ApiProperty({
    type: [Number],
    minItems: 2,
    maxItems: 2,
    description: '[longitude, latitude] (RFC 7946)',
    example: [-2.4058, 36.8297],
  })
  @IsLongitudeLatitude()
  coordinates!: [number, number];
}
