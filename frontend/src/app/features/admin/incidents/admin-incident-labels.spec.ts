import { INCIDENT } from './admin-incident.testing';
import { incidentPeople, incidentRoute, severityOf } from './admin-incident-labels';

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
