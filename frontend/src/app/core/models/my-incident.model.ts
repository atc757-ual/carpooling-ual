import type { IncidentCategory, IncidentStatus } from './admin-incident.model';

// Una incidencia que comuniqué (GET /api/users/me/incidents): sin el nombre
// de los administradores, que responden como equipo
export interface MyIncident {
  id: string;
  // «INC-0042»: para citarla
  code: string;
  trip: {
    id: string;
    originName: string | null;
    destinationName: string | null;
    departureAt: string | null;
  };
  category: IncidentCategory;
  description: string;
  reportedAt: string;
  status: IncidentStatus;
  reviewInProgress: { since: string } | null;
  // startedAt: null en las atendidas antes de existir «en revisión»
  review: { startedAt: string | null; reviewedAt: string; resolution: string } | null;
}

export interface MyIncidentPage {
  items: MyIncident[];
  total: number;
}
