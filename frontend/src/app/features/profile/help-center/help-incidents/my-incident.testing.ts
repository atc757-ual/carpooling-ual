import type { MyIncident } from '../../../../core/models/my-incident.model';

// Una incidencia registrada, para los tests de «Tus incidencias»
export const MY_INCIDENT: MyIncident = {
  id: 'inc-1',
  code: 'INC-0004',
  trip: {
    id: 'trip-1',
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL',
    departureAt: '2026-11-18T07:30:00.000Z',
  },
  category: 'technical',
  description: 'El coche se averió en la autovía.',
  reportedAt: '2026-11-18T12:52:00.000Z',
  status: 'open',
  reviewInProgress: null,
  review: null,
};
