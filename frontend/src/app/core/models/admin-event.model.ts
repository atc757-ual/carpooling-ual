// Resumen en vivo y eventos de la plataforma para la pantalla del Gemelo
// Digital del panel (GET /api/admin/overview y /api/admin/events)
export interface PlatformOverview {
  tripsPublishedToday: number;
  tripsInProgress: number;
  seatsOffered: number;
  seatsTaken: number;
  pendingRequests: number;
}

// Un evento en la lista: sin el payload (está en el detalle)
export interface AdminEventSummary {
  id: string;
  href: string;
  sequence: number;
  type: string;
  version: number;
  sourceEntityId: string;
  occurredAt: string;
}

export interface AdminEvent extends AdminEventSummary {
  payload: Record<string, unknown>;
}

export interface AdminEventQuery {
  type?: string;
  offset: number;
  limit: number;
}
