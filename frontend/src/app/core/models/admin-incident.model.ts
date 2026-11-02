// Incidencias en el panel de administración (GET /api/incidents, CU-12)
export const INCIDENT_CATEGORIES = ['technical', 'driver', 'passenger', 'other'] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];

export type IncidentStatus = 'open' | 'reviewed';

export interface AdminIncident {
  '@type'?: 'Incident';
  id: string;
  href: string;
  trip: {
    id: string;
    href: string;
    originName: string | null;
    destinationName: string | null;
    departureAt: string | null;
    driver: { id: string; name: string } | null;
  };
  reporter: { id: string; name: string; role: 'driver' | 'passenger' };
  category: IncidentCategory;
  description: string;
  reportedAt: string;
  status: IncidentStatus;
  review: { reviewedAt: string; resolution: string } | null;
}

export interface AdminIncidentQuery {
  status?: IncidentStatus;
  category?: IncidentCategory;
  offset: number;
  limit: number;
}
