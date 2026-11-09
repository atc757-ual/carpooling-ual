import { ApiProperty } from '@nestjs/swagger';
import { API_PREFIX } from '../../../app.setup';
import { tripHref } from '../../trips/dto/trip.resource';
import {
  INCIDENT_CATEGORIES,
  INCIDENT_SOURCES,
  INCIDENT_STATUSES,
} from '../entities/incident.entity';
import type {
  IncidentCategory,
  IncidentSource,
  IncidentStatus,
} from '../entities/incident.entity';
import type { IncidentView, ReporterRole } from '../incidents.service';

export class IncidentDriverResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Javier Pardo' })
  name: string;
}

// El viaje con lo que necesita quien gestiona la incidencia: el trayecto, la
// hora y el conductor (null si el viaje ya no existe)
export class IncidentTripResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '/api/trips/0b6f8a52-3c1e-4f7a-9d2b-5e8c1a4f7b90' })
  href: string;

  @ApiProperty({ example: 'Roquetas de Mar', type: String, nullable: true })
  originName: string | null;

  @ApiProperty({ example: 'Campus UAL', type: String, nullable: true })
  destinationName: string | null;

  @ApiProperty({ format: 'date-time', type: String, nullable: true })
  departureAt: string | null;

  @ApiProperty({ type: IncidentDriverResource, nullable: true })
  driver: IncidentDriverResource | null;
}

export class IncidentReporterResource {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'Lucía Martínez' })
  name: string;

  @ApiProperty({ enum: ['driver', 'passenger'] })
  role: ReporterRole;
}

// Quién la está revisando y desde cuándo (solo en revisión)
export class IncidentReviewInProgressResource {
  @ApiProperty({ type: IncidentDriverResource })
  by: IncidentDriverResource;

  @ApiProperty({ format: 'date-time' })
  since: string;
}

export class IncidentReviewResource {
  @ApiProperty({
    type: IncidentDriverResource,
    description: 'The administrator who resolved it',
  })
  by: IncidentDriverResource;

  @ApiProperty({
    format: 'date-time',
    nullable: true,
    description:
      'When that administrator started the review; null if resolved before the review states existed',
  })
  startedAt: string | null;

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

  @ApiProperty({
    example: 'INC-0042',
    description: 'Short code to cite the incident (consecutive number)',
  })
  code: string;

  @ApiProperty({ type: IncidentTripResource })
  trip: IncidentTripResource;

  @ApiProperty({ type: IncidentReporterResource })
  reporter: IncidentReporterResource;

  @ApiProperty({
    enum: INCIDENT_SOURCES,
    description:
      'trip: reported while cancelling a trip in progress; chat: a report of the trip chat',
  })
  source: IncidentSource;

  @ApiProperty({ enum: INCIDENT_CATEGORIES })
  category: IncidentCategory;

  @ApiProperty()
  description: string;

  @ApiProperty({ format: 'date-time' })
  reportedAt: string;

  @ApiProperty({ enum: INCIDENT_STATUSES })
  status: IncidentStatus;

  @ApiProperty({
    description:
      'True when the administrator asking is involved in the trip (reported it, drives it or requested a seat): another administrator must manage it',
  })
  isViewerInvolved: boolean;

  @ApiProperty({
    type: IncidentReviewInProgressResource,
    nullable: true,
    description: 'Who is reviewing it (CU-12); null unless in_review',
  })
  reviewInProgress: IncidentReviewInProgressResource | null;

  @ApiProperty({
    type: IncidentReviewResource,
    nullable: true,
    description: 'The review of the administrator (CU-12); null while open',
  })
  review: IncidentReviewResource | null;
}

// «INC-0042»: el número con al menos cuatro cifras
export function incidentCode(number: number): string {
  return `INC-${String(number).padStart(4, '0')}`;
}

export function incidentHref(id: string): string {
  return `/${API_PREFIX}/incidents/${id}`;
}

export function toIncidentResource({
  incident,
  reporterName,
  reporterRole,
  reviewStartedByName,
  reviewedByName,
  isViewerInvolved,
  trip,
}: IncidentView): IncidentResource {
  const {
    reviewedAt,
    reviewedBy,
    resolution,
    reviewStartedBy,
    reviewStartedAt,
  } = incident;
  return {
    '@type': 'Incident',
    id: incident.id,
    href: incidentHref(incident.id),
    code: incidentCode(incident.number),
    trip: {
      id: incident.tripId,
      href: tripHref(incident.tripId),
      originName: trip?.originName ?? null,
      destinationName: trip?.destinationName ?? null,
      departureAt: trip?.departureAt.toISOString() ?? null,
      driver: trip ? { id: trip.driverId, name: trip.driverName } : null,
    },
    reporter: {
      id: incident.reporterId,
      name: reporterName,
      role: reporterRole,
    },
    source: incident.source,
    category: incident.category,
    description: incident.description,
    reportedAt: incident.createdAt.toISOString(),
    status: incident.status,
    isViewerInvolved,
    reviewInProgress:
      incident.status === 'in_review' &&
      reviewStartedBy !== null &&
      reviewStartedAt !== null
        ? {
            by: { id: reviewStartedBy, name: reviewStartedByName ?? '' },
            since: reviewStartedAt.toISOString(),
          }
        : null,
    review:
      reviewedAt !== null && reviewedBy !== null && resolution !== null
        ? {
            by: { id: reviewedBy, name: reviewedByName ?? '' },
            // Solo quien la empezó puede atenderla: su inicio es el de esta
            // revisión
            startedAt: reviewStartedAt?.toISOString() ?? null,
            reviewedAt: reviewedAt.toISOString(),
            resolution,
          }
        : null,
  };
}
