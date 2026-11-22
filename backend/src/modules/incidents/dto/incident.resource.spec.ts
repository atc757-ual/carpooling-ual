import type { Incident } from '../entities/incident.entity';
import type { IncidentView } from '../incidents.service';
import {
  incidentCode,
  toIncidentResource,
  toReporterIncidentResource,
} from './incident.resource';

describe('incidentCode', () => {
  it('pads the number to four digits and grows beyond them', () => {
    expect(incidentCode(1)).toBe('INC-0001');
    expect(incidentCode(42)).toBe('INC-0042');
    expect(incidentCode(12345)).toBe('INC-12345');
  });
});

const STARTED_AT = new Date('2026-11-20T09:00:00Z');
const REVIEWED_AT = new Date('2026-11-20T10:00:00Z');

function view(incident: Partial<Incident>): IncidentView {
  return {
    incident: {
      id: 'incident-1',
      number: 7,
      tripId: 'trip-1',
      reporterId: 'reporter-1',
      source: 'trip',
      category: 'technical',
      description: 'The car broke down',
      createdAt: new Date('2026-11-20T08:00:00Z'),
      status: 'open',
      reviewStartedBy: null,
      reviewStartedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      resolution: null,
      ...incident,
    } as Incident,
    reporterName: 'Lucía Martínez',
    reporterRole: 'passenger',
    reviewStartedByName: 'Admin One',
    reviewedByName: 'Admin One',
    isViewerInvolved: false,
    trip: null,
  };
}

describe('toReporterIncidentResource', () => {
  it('hides the administrator who is reviewing it', () => {
    const inReview = view({
      status: 'in_review',
      reviewStartedBy: 'admin-1',
      reviewStartedAt: STARTED_AT,
    });

    expect(toIncidentResource(inReview).reviewInProgress?.by).toEqual({
      id: 'admin-1',
      name: 'Admin One',
    });
    expect(toReporterIncidentResource(inReview).reviewInProgress).toEqual({
      by: null,
      since: STARTED_AT.toISOString(),
    });
  });

  it('keeps the resolution but hides who wrote it', () => {
    const reviewed = toReporterIncidentResource(
      view({
        status: 'reviewed',
        reviewStartedBy: 'admin-1',
        reviewStartedAt: STARTED_AT,
        reviewedBy: 'admin-1',
        reviewedAt: REVIEWED_AT,
        resolution: 'We called the driver',
      }),
    );

    expect(reviewed.review).toEqual({
      by: null,
      startedAt: STARTED_AT.toISOString(),
      reviewedAt: REVIEWED_AT.toISOString(),
      resolution: 'We called the driver',
    });
  });

  it('leaves an open incident without review', () => {
    const open = toReporterIncidentResource(view({}));

    expect(open.reviewInProgress).toBeNull();
    expect(open.review).toBeNull();
  });
});
