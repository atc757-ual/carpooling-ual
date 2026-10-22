import { ApiProperty } from '@nestjs/swagger';
import { tripHref } from '../../trips/dto/trip.resource';
import { Incident, INCIDENT_CATEGORIES } from '../entities/incident.entity';
import type { IncidentCategory } from '../entities/incident.entity';

export class IncidentTripResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;
}

// Recurso TMF630 Incident. Sin href: el GET de una incidencia llegará con la
// revisión del administrador (CU-12), y solo se enlaza lo que existe
export class IncidentResource {
  @ApiProperty({ enum: ['Incident'] })
  '@type': 'Incident';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: IncidentTripResource })
  trip: IncidentTripResource;

  @ApiProperty({ enum: INCIDENT_CATEGORIES })
  category: IncidentCategory;

  @ApiProperty()
  description: string;

  @ApiProperty({ format: 'date-time' })
  reportedAt: string;
}

export function toIncidentResource(incident: Incident): IncidentResource {
  return {
    '@type': 'Incident',
    id: incident.id,
    trip: { id: incident.tripId, href: tripHref(incident.tripId) },
    category: incident.category,
    description: incident.description,
    reportedAt: incident.createdAt.toISOString(),
  };
}
