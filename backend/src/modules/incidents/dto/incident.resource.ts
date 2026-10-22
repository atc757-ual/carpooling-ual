import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import { tripHref } from '../../trips/dto/trip.resource';
import {
  INCIDENT_CATEGORIES,
  INCIDENT_STATUSES,
} from '../entities/incident.entity';
import type {
  IncidentCategory,
  IncidentStatus,
} from '../entities/incident.entity';
import type { IncidentView, ReporterRole } from '../incidents.service';

export class IncidentTripResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;
}

export class IncidentReporterResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lucía Martínez' })
  name: string;

  @ApiProperty({ enum: ['driver', 'passenger'] })
  role: ReporterRole;
}

export class IncidentReviewResource {
  @ApiProperty({ format: 'date-time' })
  reviewedAt: string;

  @ApiProperty({ example: 'The driver was contacted and the car was repaired' })
  resolution: string;
}

// Recurso TMF630 Incident. Lo ven quien la registró y los administradores
export class IncidentResource {
  @ApiProperty({ enum: ['Incident'] })
  '@type': 'Incident';

  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({
    example: '/api/incidents/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90',
  })
  href: string;

  @ApiProperty({ type: IncidentTripResource })
  trip: IncidentTripResource;

  @ApiProperty({ type: IncidentReporterResource })
  reporter: IncidentReporterResource;

  @ApiProperty({ enum: INCIDENT_CATEGORIES })
  category: IncidentCategory;

  @ApiProperty()
  description: string;

  @ApiProperty({ format: 'date-time' })
  reportedAt: string;

  @ApiProperty({ enum: INCIDENT_STATUSES })
  status: IncidentStatus;

  @ApiProperty({
    type: IncidentReviewResource,
    nullable: true,
    description: 'The review of the administrator (CU-12); null while open',
  })
  review: IncidentReviewResource | null;
}

export function incidentHref(id: string): string {
  return `/${API_PREFIX}/incidents/${id}`;
}

export function toIncidentResource({
  incident,
  reporterName,
  reporterRole,
}: IncidentView): IncidentResource {
  const { reviewedAt, resolution } = incident;
  return {
    '@type': 'Incident',
    id: incident.id,
    href: incidentHref(incident.id),
    trip: { id: incident.tripId, href: tripHref(incident.tripId) },
    reporter: {
      id: incident.reporterId,
      name: reporterName,
      role: reporterRole,
    },
    category: incident.category,
    description: incident.description,
    reportedAt: incident.createdAt.toISOString(),
    status: incident.status,
    review:
      reviewedAt !== null && resolution !== null
        ? { reviewedAt: reviewedAt.toISOString(), resolution }
        : null,
  };
}
