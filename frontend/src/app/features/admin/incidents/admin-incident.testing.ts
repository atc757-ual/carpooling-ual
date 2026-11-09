import { AdminIncident } from '../../../core/models/admin-incident.model';

// Incidencia de ejemplo para los tests del panel
export const INCIDENT: AdminIncident = {
  id: 'i1',
  href: '/api/incidents/i1',
  code: 'INC-0042',
  trip: {
    id: 't1',
    href: '/api/trips/t1',
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL',
    departureAt: '2026-11-02T07:40:00.000Z',
    driver: { id: 'd1', name: 'Javier Pardo' },
  },
  reporter: { id: 'p1', name: 'Lucía Cortés', role: 'passenger' },
  source: 'trip',
  category: 'driver',
  description: 'The driver did not stop at the pickup point',
  reportedAt: '2026-11-02T08:05:00.000Z',
  status: 'open',
  isViewerInvolved: false,
  reviewInProgress: null,
  review: null,
};
