import { AdminIncident } from '../../../core/models/admin-incident.model';
import { incidentPeople, incidentRoute, severityOf } from './admin-incident-labels';

export const INCIDENT: AdminIncident = {
  id: 'i1',
  href: '/api/incidents/i1',
  trip: {
    id: 't1',
    href: '/api/trips/t1',
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL',
    departureAt: '2026-11-02T07:40:00.000Z',
    driver: { id: 'd1', name: 'Javier Pardo' },
  },
  reporter: { id: 'p1', name: 'Lucía Cortés', role: 'passenger' },
  category: 'driver',
  description: 'The driver did not stop at the pickup point',
  reportedAt: '2026-11-02T08:05:00.000Z',
  status: 'open',
  review: null,
};

describe('admin incident labels', () => {
  it('marks the severity by category', () => {
    expect(severityOf('driver')).toBe('danger');
    expect(severityOf('passenger')).toBe('danger');
    expect(severityOf('technical')).toBe('warning');
    expect(severityOf('other')).toBe('neutral');
  });

  it('writes the route and the people involved', () => {
    expect(incidentRoute(INCIDENT)).toBe('Roquetas de Mar → Campus UAL');
    expect(
      incidentRoute({ trip: { ...INCIDENT.trip, originName: null, destinationName: null } }),
    ).toBe('Origen → Destino');
    expect(incidentPeople(INCIDENT)).toBe(
      'Notificada por Lucía Cortés (pasajero) · conductor: Javier Pardo',
    );
    expect(
      incidentPeople({
        reporter: { id: 'd1', name: 'Javier Pardo', role: 'driver' },
        trip: INCIDENT.trip,
      }),
    ).toBe('Notificada por Javier Pardo (conductor)');
  });
});
