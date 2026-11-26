import type { EntityManager } from 'typeorm';
import type { EventsService } from '../../events/events.service';
import type { Incident } from './entities/incident.entity';
import { recordIncidentEvent, reporterRoleOf } from './incident-events';

describe('incident-events', () => {
  const baseIncident = {
    id: 'inc-1',
    number: 101,
    tripId: 'trip-1',
    requestId: null,
    reporterId: 'user-1',
    source: 'trip',
    category: 'safety',
    status: 'open',
    reviewStartedBy: null,
    reviewedBy: null,
  } as unknown as Incident;

  it('resolves reporterRoleOf using driverId when provided, or requestId when driverId is omitted', () => {
    const withoutReq: Incident = { ...baseIncident, requestId: null };
    const withReq: Incident = { ...baseIncident, requestId: 'req-1' };

    expect(reporterRoleOf(baseIncident, 'user-1')).toBe('driver');
    expect(reporterRoleOf(baseIncident, 'user-2')).toBe('passenger');
    expect(reporterRoleOf(withoutReq)).toBe('driver');
    expect(reporterRoleOf(withReq)).toBe('passenger');
  });

  it('records the incident event payload with the computed reporterRole', async () => {
    const record = jest.fn().mockResolvedValue(undefined);
    const events = { record } as unknown as EventsService;
    const manager = {} as EntityManager;

    await recordIncidentEvent(events, manager, {
      type: 'incident.created' as never,
      incident: baseIncident,
      driverId: 'user-1',
    });

    expect(record).toHaveBeenCalledTimes(1);
  });
});
