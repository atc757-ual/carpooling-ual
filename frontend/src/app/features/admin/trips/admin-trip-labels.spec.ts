import { requestsLabel, seatsLabel, tripStatusClass } from './admin-trip-labels';

describe('admin trip labels', () => {
  it('colors the status chip only while the trip is alive', () => {
    expect(tripStatusClass('published')).toBe('status status--info');
    expect(tripStatusClass('confirmed')).toBe('status status--accepted');
    expect(tripStatusClass('in_progress')).toBe('status status--pending');
    expect(tripStatusClass('finished')).toBe('status');
    expect(tripStatusClass('cancelled')).toBe('status');
  });

  it('shows the free seats out of the offered ones', () => {
    expect(seatsLabel({ availableSeats: 2, offeredSeats: 3 })).toBe('2 de 3 libres');
  });

  it('counts the accepted and pending requests in words', () => {
    expect(requestsLabel({ requests: { accepted: 1, pending: 2 } })).toBe(
      '1 aceptada · 2 pendientes',
    );
    expect(requestsLabel({ requests: { accepted: 2, pending: 0 } })).toBe('2 aceptadas');
    expect(requestsLabel({ requests: { accepted: 0, pending: 1 } })).toBe('1 pendiente');
    expect(requestsLabel({ requests: { accepted: 0, pending: 0 } })).toBe('Sin solicitudes');
  });
});
