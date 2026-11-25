import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ApiError } from '../../../../core/models/api-error.model';
import type { MyIncident } from '../../../../core/models/my-incident.model';
import { IncidentsService } from '../../../../core/services/incidents/incidents.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { HelpIncidentModal } from './help-incident-modal';
import { hasPriorityIncidents, injectHelpIncidentLink } from './help-incidents-priority';

const NOW = new Date('2026-11-25T10:00:00.000Z');

function incident(overrides: Partial<MyIncident> = {}): MyIncident {
  return {
    id: 'i1',
    code: 'INC-0001',
    trip: { id: 't1', code: 'VJ-0001', originName: null, destinationName: null, departureAt: null },
    category: 'driver',
    description: 'Llegó tarde',
    reportedAt: '2026-11-01T08:00:00.000Z',
    status: 'reviewed',
    reviewInProgress: null,
    review: {
      startedAt: null,
      reviewedAt: '2026-11-02T08:00:00.000Z',
      resolution: 'Hablamos con él',
    },
    ...overrides,
  };
}

describe('hasPriorityIncidents', () => {
  it('puts first the open, the ones in review and the ones dealt with in the last 7 days', () => {
    expect(hasPriorityIncidents([], NOW)).toBe(false);
    expect(hasPriorityIncidents([incident()], NOW)).toBe(false);
    expect(hasPriorityIncidents([incident({ status: 'open', review: null })], NOW)).toBe(true);
    expect(hasPriorityIncidents([incident({ status: 'in_review', review: null })], NOW)).toBe(true);
    const recent = incident({
      review: { startedAt: null, reviewedAt: '2026-11-20T10:00:00.000Z', resolution: 'Hecho' },
    });
    expect(hasPriorityIncidents([incident(), recent], NOW)).toBe(true);
  });
});

describe('injectHelpIncidentLink', () => {
  const getMine = vi.fn();
  const navigate = vi.fn().mockResolvedValue(true);
  const present = vi.fn().mockResolvedValue(undefined);
  const create = vi.fn().mockResolvedValue({ present });
  const showError = vi.fn().mockResolvedValue(undefined);

  function linkFor(query: Record<string, string>): () => Promise<void> {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideAppTransloco(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
        { provide: Router, useValue: { navigate } },
        { provide: ModalController, useValue: { create } },
        { provide: IncidentsService, useValue: { getMine } },
        { provide: ToastService, useValue: { showError } },
      ],
    });
    return TestBed.runInInjectionContext(() => injectHelpIncidentLink());
  }

  it('opens the incident of the link and drops the parameter', async () => {
    const open = linkFor({ incident: 'i1' });
    getMine.mockResolvedValue(incident());

    await open();

    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { incident: null }, replaceUrl: true }),
    );
    expect(getMine).toHaveBeenCalledWith('i1');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        component: HelpIncidentModal,
        componentProps: { incident: incident() },
      }),
    );
    expect(present).toHaveBeenCalled();
  });

  it('does nothing without a link and shows the error when it cannot load it', async () => {
    await linkFor({})();
    expect(getMine).not.toHaveBeenCalled();

    const open = linkFor({ incident: 'i9' });
    getMine.mockRejectedValue(new ApiError('INCIDENT_NOT_FOUND', 404));
    await open();
    expect(create).not.toHaveBeenCalled();
    expect(showError).toHaveBeenCalled();
  });
});
