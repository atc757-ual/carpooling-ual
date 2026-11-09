import { AdminIncident } from '../../../core/models/admin-incident.model';
import { INCIDENT } from './admin-incident.testing';
import {
  incidentDetailView,
  incidentMoments,
  incidentStatus,
  incidentRoute,
  reviewStateOf,
  severityOf,
} from './admin-incident-labels';

const ADA = { id: 'a1', name: 'Ada Admin' };
const STARTED_AT = '2026-11-02T09:00:00.000Z';
const REVIEWED_AT = '2026-11-02T10:00:00.000Z';

const IN_REVIEW: AdminIncident = {
  ...INCIDENT,
  status: 'in_review',
  reviewInProgress: { by: ADA, since: STARTED_AT },
};

const REVIEWED: AdminIncident = {
  ...INCIDENT,
  status: 'reviewed',
  review: {
    by: ADA,
    startedAt: STARTED_AT,
    reviewedAt: REVIEWED_AT,
    resolution: 'Both were contacted',
  },
};

describe('admin incident labels', () => {
  it('marks the severity by category', () => {
    expect(severityOf('driver')).toBe('danger');
    expect(severityOf('passenger')).toBe('danger');
    expect(severityOf('technical')).toBe('warning');
    expect(severityOf('other')).toBe('neutral');
  });

  it('writes the route', () => {
    expect(incidentRoute(INCIDENT)).toBe('Roquetas de Mar → Campus UAL');
    expect(
      incidentRoute({ trip: { ...INCIDENT.trip, originName: null, destinationName: null } }),
    ).toBe('Origen → Destino');
  });

  it('names the three statuses with their label class', () => {
    expect(incidentStatus('open')).toEqual({
      label: 'Registrada',
      cssClass: 'status status--pending',
    });
    expect(incidentStatus('in_review')).toEqual({
      label: 'En revisión',
      cssClass: 'status status--info',
    });
    expect(incidentStatus('reviewed')).toEqual({
      label: 'Atendida',
      cssClass: 'status status--accepted',
    });
  });

  it('tells what the admin can do with the review', () => {
    expect(reviewStateOf(INCIDENT, 'a1')).toBe('open');
    expect(reviewStateOf(IN_REVIEW, 'a1')).toBe('mine');
    expect(reviewStateOf(IN_REVIEW, 'b2')).toBe('other');
    expect(reviewStateOf(IN_REVIEW, undefined)).toBe('other');
    expect(reviewStateOf(REVIEWED, 'a1')).toBe('done');
  });

  it('keeps an admin involved in the trip out of the review, until it is resolved', () => {
    expect(reviewStateOf({ ...INCIDENT, isViewerInvolved: true }, 'a1')).toBe('involved');
    expect(reviewStateOf({ ...IN_REVIEW, isViewerInvolved: true }, 'a1')).toBe('involved');
    expect(reviewStateOf({ ...REVIEWED, isViewerInvolved: true }, 'a1')).toBe('done');
  });

  it('builds the detail: the code as title, the trip and the people', () => {
    const view = incidentDetailView(INCIDENT);

    expect(view).toMatchObject({
      title: 'INC-0042',
      category: 'Con el conductor',
      status: 'Registrada',
      severity: 'danger',
      reporter: 'Lucía Cortés (pasajero)',
      origin: 'Roquetas de Mar',
      destination: 'Campus UAL',
      tripLink: ['/admin/trips', 't1'],
      reviewer: null,
      reviewSince: null,
    });
    expect(view.people.map(({ name, role }) => [name, role])).toEqual([
      ['Lucía Cortés', 'La registró · pasajero'],
      ['Javier Pardo', 'Conductor del viaje'],
    ]);
    expect(incidentDetailView(IN_REVIEW).reviewer).toBe('Ada Admin');
  });

  it('lists the driver once when she reported it, and no trip link once it is gone', () => {
    const view = incidentDetailView({
      ...REVIEWED,
      reporter: { id: 'd1', name: 'Javier Pardo', role: 'driver' },
      trip: {
        ...INCIDENT.trip,
        originName: null,
        destinationName: null,
        departureAt: null,
        driver: null,
      },
    });

    expect(view).toMatchObject({
      status: 'Atendida',
      origin: 'Origen',
      destination: 'Destino',
      departureAt: null,
      tripLink: null,
    });
    expect(view.people.map(({ id }) => id)).toEqual(['d1']);
  });

  describe('moments of the review', () => {
    const summary = (incident: AdminIncident) =>
      incidentMoments(incident).map(({ label, isDone, datetime, detail, note }) => ({
        label,
        isDone,
        datetime,
        detail,
        note,
      }));

    it('a registered one: when and who, the rest pending', () => {
      expect(summary(INCIDENT)).toEqual([
        {
          label: 'Registrada',
          isDone: true,
          datetime: INCIDENT.reportedAt,
          detail: 'Por Lucía Cortés (pasajero)',
          note: null,
        },
        { label: 'En revisión', isDone: false, datetime: null, detail: null, note: null },
        { label: 'Atendida', isDone: false, datetime: null, detail: null, note: null },
      ]);
      expect(incidentMoments(INCIDENT)[0].time).not.toBeNull();
      expect(incidentMoments(INCIDENT)[1].time).toBeNull();
    });

    it('one in review: who has it since when', () => {
      expect(summary(IN_REVIEW)[1]).toEqual({
        label: 'En revisión',
        isDone: true,
        datetime: STARTED_AT,
        detail: 'Por Ada Admin',
        note: null,
      });
      expect(summary(IN_REVIEW)[2].isDone).toBe(false);
    });

    it('a resolved one: who started it and who resolved it, with the resolution', () => {
      expect(summary(REVIEWED).slice(1)).toEqual([
        {
          label: 'En revisión',
          isDone: true,
          datetime: STARTED_AT,
          detail: 'Por Ada Admin',
          note: null,
        },
        {
          label: 'Atendida',
          isDone: true,
          datetime: REVIEWED_AT,
          detail: 'Por Ada Admin',
          note: 'Both were contacted',
        },
      ]);
    });

    it('skips the review start of one resolved before it existed', () => {
      const old: AdminIncident = {
        ...REVIEWED,
        review: { by: ADA, startedAt: null, reviewedAt: REVIEWED_AT, resolution: 'Done' },
      };

      expect(summary(old).map(({ label }) => label)).toEqual(['Registrada', 'Atendida']);
    });
  });
});
