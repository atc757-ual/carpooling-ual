// Incidencias en el panel de administración (GET /api/incidents, CU-12)
export const INCIDENT_CATEGORIES = [
  'technical',
  'driver',
  'passenger',
  'safety',
  'chat_behavior',
  'other',
] as const;
export type IncidentCategory = (typeof INCIDENT_CATEGORIES)[number];
// De dónde viene: el viaje en curso (al cancelarlo) o una denuncia del chat
export type IncidentSource = 'trip' | 'chat';

// Registrada → en revisión (la lleva un administrador) → atendida
export type IncidentStatus = 'open' | 'in_review' | 'reviewed';

export interface AdminIncident {
  '@type'?: 'Incident';
  id: string;
  href: string;
  // «INC-0042»: para citarla
  code: string;
  trip: {
    id: string;
    href: string;
    originName: string | null;
    destinationName: string | null;
    departureAt: string | null;
    driver: { id: string; name: string } | null;
  };
  reporter: { id: string; name: string; role: 'driver' | 'passenger' };
  source: IncidentSource;
  category: IncidentCategory;
  description: string;
  reportedAt: string;
  status: IncidentStatus;
  // El administrador que la consulta está implicado en el viaje (la registró,
  // lo conduce o pidió plaza): la gestiona otro
  isViewerInvolved: boolean;
  // Quién la está revisando y desde cuándo (solo en revisión)
  reviewInProgress: { by: { id: string; name: string }; since: string } | null;
  // La revisión terminada: quién la atendió, cuándo la empezó (null en las
  // atendidas antes de existir «en revisión»), cuándo terminó y cómo
  review: {
    by: { id: string; name: string };
    startedAt: string | null;
    reviewedAt: string;
    resolution: string;
  } | null;
}

export interface AdminIncidentQuery {
  status?: IncidentStatus;
  category?: IncidentCategory;
  offset: number;
  limit: number;
}
