import {
  EVENT_TYPE_GROUPS,
  eventEntityLabel,
  eventTypeLabel,
  formatPayload,
  isKnownEventType,
  overviewKpis,
} from './event-labels';

describe('event labels', () => {
  it('names every event type once', () => {
    const types = EVENT_TYPE_GROUPS.flatMap((group) => group.types.map(([type]) => type));
    expect(new Set(types).size).toBe(types.length);
    expect(types).toHaveLength(37);
  });

  it('names known types and keeps unknown ones as they are', () => {
    expect(eventTypeLabel('trip.published')).toBe('Viaje publicado');
    expect(eventTypeLabel('trip.teleported')).toBe('trip.teleported');
    expect(isKnownEventType('request.accepted')).toBe(true);
    expect(isKnownEventType('trip.teleported')).toBe(false);
  });

  it('shows the source entity with the start of its id', () => {
    expect(eventEntityLabel('trip.started', '3f2a9c1e-0000-4000-8000-000000000000')).toBe(
      'Viaje · 3f2a9c1e',
    );
    expect(eventEntityLabel('coverage.gap_reported', 'abcdef123456')).toBe('Búsqueda · abcdef12');
    expect(eventEntityLabel('alien.landed', 'abcdef123456')).toBe('Entidad · abcdef12');
  });

  it('formats the payload with indentation', () => {
    expect(formatPayload({ status: 'published' })).toBe('{\n  "status": "published"\n}');
  });

  it('builds the overview cards with the occupancy', () => {
    const kpis = overviewKpis({
      tripsPublishedToday: 24,
      tripsInProgress: 8,
      seatsOffered: 60,
      seatsTaken: 41,
      pendingRequests: 12,
    });
    expect(kpis.map(({ value }) => value)).toEqual(['24', '8', '60', '41', '12']);
    expect(kpis[3].hint).toBe('68 % de ocupación');
  });

  it('shows no occupancy without seats offered', () => {
    const kpis = overviewKpis({
      tripsPublishedToday: 0,
      tripsInProgress: 0,
      seatsOffered: 0,
      seatsTaken: 0,
      pendingRequests: 0,
    });
    expect(kpis[3].hint).toBe('0 % de ocupación');
  });
});
