import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import { GeoPointDto } from '../../../shared/geo/geo-point.dto';
import type { Place, PlaceSuggestion } from '../places.service';

const ID_EXAMPLE = 'cG9ydGFsfDAxLjA0Lk1VTl8wNDAxMzAyMzQ1MTV8MTIw';

// Recurso TMF630 PlaceSuggestion: una dirección mientras se escribe, sin
// coordenadas; su href lleva a la dirección completa
export class PlaceSuggestionResource {
  @ApiProperty({ enum: ['PlaceSuggestion'] })
  '@type': 'PlaceSuggestion';

  @ApiProperty({ example: ID_EXAMPLE })
  id: string;

  @ApiProperty({ example: `/api/places/${ID_EXAMPLE}` })
  href: string;

  @ApiProperty({ example: 'Avenida del Mediterraneo, 120' })
  name: string;

  @ApiProperty({ example: 'Almería' })
  locality: string;
}

// Recurso TMF630 Place: una dirección con su punto y si está en la zona de
// servicio (30 km alrededor del campus)
export class PlaceResource {
  @ApiProperty({ enum: ['Place'] })
  '@type': 'Place';

  @ApiProperty({ example: ID_EXAMPLE })
  id: string;

  @ApiProperty({ example: `/api/places/${ID_EXAMPLE}` })
  href: string;

  @ApiProperty({ example: 'Avenida del Mediterraneo, 120' })
  name: string;

  @ApiProperty({ example: 'Almería' })
  locality: string;

  @ApiProperty({ example: 'Almería' })
  municipality: string;

  @ApiProperty({
    type: GeoPointDto,
    example: { type: 'Point', coordinates: [-2.44615, 36.83256] },
  })
  location: GeoPointDto;

  @ApiProperty({
    description: 'Whether the place is inside the service area',
    example: true,
  })
  isCovered: boolean;
}

export function placeHref(id: string): string {
  return `/${API_PREFIX}/places/${id}`;
}

export function toPlaceSuggestionResource(
  suggestion: PlaceSuggestion,
): PlaceSuggestionResource {
  return {
    '@type': 'PlaceSuggestion',
    id: suggestion.id,
    href: placeHref(suggestion.id),
    name: suggestion.name,
    locality: suggestion.locality,
  };
}

export function toPlaceResource(place: Place): PlaceResource {
  return {
    '@type': 'Place',
    id: place.id,
    href: placeHref(place.id),
    name: place.name,
    locality: place.locality,
    municipality: place.municipality,
    location: {
      type: 'Point',
      coordinates: [place.location.lon, place.location.lat],
    },
    isCovered: place.isCovered,
  };
}
