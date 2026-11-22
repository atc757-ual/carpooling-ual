import { TestBed } from '@angular/core/testing';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideTestingTransloco } from '../../../../core/i18n/testing-transloco';
import type { MyIncident } from '../../../../core/models/my-incident.model';
import { HelpIncidentModal, incidentMoments } from './help-incident-modal';
import { incidentCategoryKey, incidentRoute } from './my-incident-labels';
import { MY_INCIDENT } from './my-incident.testing';

const REVIEWED: MyIncident = {
  ...MY_INCIDENT,
  category: 'chat_behavior',
  status: 'reviewed',
  review: {
    startedAt: '2026-11-19T09:00:00.000Z',
    reviewedAt: '2026-11-19T10:00:00.000Z',
    resolution: 'Hemos hablado con el conductor.',
  },
};

describe('incidentMoments', () => {
  it('dates only the moments already reached', () => {
    expect(incidentMoments(MY_INCIDENT).map(({ at }) => at)).toEqual([
      MY_INCIDENT.reportedAt,
      null,
      null,
    ]);
  });

  it('dates the review while it is in progress', () => {
    const inReview: MyIncident = {
      ...MY_INCIDENT,
      status: 'in_review',
      reviewInProgress: { since: '2026-11-19T09:00:00.000Z' },
    };

    expect(incidentMoments(inReview)[1].at).toBe('2026-11-19T09:00:00.000Z');
  });

  it('takes the start of the review from the review once resolved', () => {
    expect(incidentMoments(REVIEWED).map(({ at }) => at)).toEqual([
      MY_INCIDENT.reportedAt,
      '2026-11-19T09:00:00.000Z',
      '2026-11-19T10:00:00.000Z',
    ]);
  });
});

describe('my incident labels', () => {
  it('maps every category to its text, short or long', () => {
    expect(incidentCategoryKey('chat_behavior', true)).toBe(
      'screens.incidentCategories.chatBehaviorShort',
    );
    expect(incidentCategoryKey('technical')).toBe('screens.incidentCategories.technical');
  });

  it('joins the trip names and skips the missing ones', () => {
    expect(incidentRoute(MY_INCIDENT)).toBe('Roquetas de Mar → Campus UAL');
    expect(
      incidentRoute({
        ...MY_INCIDENT,
        trip: { ...MY_INCIDENT.trip, originName: null, destinationName: null },
      }),
    ).toBe('');
  });
});

describe('HelpIncidentModal', () => {
  function render(incident: MyIncident): HTMLElement {
    TestBed.configureTestingModule({
      imports: [HelpIncidentModal],
      providers: [
        provideIonicAngular(),
        provideTestingTransloco(),
        { provide: ModalController, useValue: { dismiss: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(HelpIncidentModal);
    fixture.componentRef.setInput('incident', incident);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the reply of the team once resolved', () => {
    const element = render(REVIEWED);

    expect(element.querySelector('.help-incident__answer')?.textContent).toContain(
      'Hemos hablado con el conductor.',
    );
    expect(element.querySelector('.help-incident__pending')).toBeNull();
    expect(element.querySelector('.status')?.classList).toContain('status--accepted');
  });

  it('explains that the reply will come while it is open', () => {
    const element = render({
      ...MY_INCIDENT,
      trip: { ...MY_INCIDENT.trip, originName: null, destinationName: null },
    });

    expect(element.querySelector('.help-incident__answer')).toBeNull();
    expect(element.querySelector('.help-incident__pending')).not.toBeNull();
    expect(element.querySelectorAll('.help-incident__moment--pending')).toHaveLength(2);
    expect(element.querySelector('.help-incident__trip')).not.toBeNull();
  });

  it('closes the window', () => {
    TestBed.configureTestingModule({
      imports: [HelpIncidentModal],
      providers: [provideIonicAngular(), provideTestingTransloco()],
    });
    const dismiss = vi.fn().mockResolvedValue(true);
    TestBed.overrideProvider(ModalController, { useValue: { dismiss } });
    const fixture = TestBed.createComponent(HelpIncidentModal);
    fixture.componentRef.setInput('incident', MY_INCIDENT);

    fixture.componentInstance.close();

    expect(dismiss).toHaveBeenCalled();
  });
});
