import { INCIDENT } from './admin-incident.testing';
import {
  incidentDetailView,
  incidentPeople,
  incidentRoute,
  severityOf,
} from './admin-incident-labels';

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

  it('builds the detail: the code as title, the trip and the people', () => {
    const view = incidentDetailView(INCIDENT);

    expect(view).toMatchObject({
      title: 'INC-0042',
      category: 'Con el conductor',
      status: 'Abierta',
      severity: 'danger',
      reporter: 'Lucía Cortés (pasajero)',
      origin: 'Roquetas de Mar',
      destination: 'Campus UAL',
      tripLink: ['/admin/trips', 't1'],
      reviewedAt: null,
    });
    expect(view.people.map(({ name, role }) => [name, role])).toEqual([
      ['Lucía Cortés', 'La registró · pasajero'],
      ['Javier Pardo', 'Conductor del viaje'],
    ]);
  });

  it('lists the driver once when she reported it, and no trip link once it is gone', () => {
    const view = incidentDetailView({
      ...INCIDENT,
      reporter: { id: 'd1', name: 'Javier Pardo', role: 'driver' },
      trip: {
        ...INCIDENT.trip,
        originName: null,
        destinationName: null,
        departureAt: null,
        driver: null,
      },
      status: 'reviewed',
      review: { reviewedAt: '2026-11-02T10:00:00.000Z', resolution: 'Both were contacted' },
    });

    expect(view).toMatchObject({
      status: 'Revisada',
      origin: 'Origen',
      destination: 'Destino',
      departureAt: null,
      tripLink: null,
    });
    expect(view.reviewedAt).not.toBeNull();
    expect(view.people.map(({ id }) => id)).toEqual(['d1']);
  });
});
