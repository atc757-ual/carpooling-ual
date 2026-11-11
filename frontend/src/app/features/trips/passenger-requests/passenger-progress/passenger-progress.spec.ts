import { TestBed } from '@angular/core/testing';
import { provideIonicAngular } from '@ionic/angular';
import { Trip } from '../../../../core/models/driver.model';
import { SeatRequest } from '../../../../core/models/seat-request.model';
import { buildProgressSteps, formatStepTime, PassengerProgress } from './passenger-progress';

const trip = (status: Trip['status']) => ({ status }) as Trip;
const request = (status: SeatRequest['status'], changes: Partial<SeatRequest> = {}) =>
  ({
    status,
    requestedAt: '2026-11-11T12:03:00Z',
    answeredAt: '2026-11-11T12:06:00Z',
    cancelledAt: '2026-11-11T12:10:00Z',
    boardedAt: null,
    rejectionReason: null,
    ...changes,
  }) as SeatRequest;
const states = (steps: ReturnType<typeof buildProgressSteps>) =>
  steps.map(({ label, state }) => `${label}:${state}`);

describe('PassengerProgress', () => {
  it('waits for the driver while pending, without marking a current step', () => {
    expect(states(buildProgressSteps(request('pending'), trip('published')))).toEqual([
      'Solicitada:done',
      'Confirmada:upcoming',
      'En curso:upcoming',
      'Finalizado:upcoming',
    ]);
  });

  it('highlights «En curso» only once the trip has started', () => {
    expect(states(buildProgressSteps(request('accepted'), trip('confirmed')))).toEqual([
      'Solicitada:done',
      'Confirmada:done',
      'En curso:upcoming',
      'Finalizado:upcoming',
    ]);
    expect(states(buildProgressSteps(request('accepted'), trip('in_progress')))[2]).toBe(
      'En curso:current',
    );
    expect(states(buildProgressSteps(request('accepted'), trip('finished')))[3]).toBe(
      'Finalizado:done',
    );
  });

  it('closes with the reason when the request did not go ahead', () => {
    const last = (req: SeatRequest, status: Trip['status'] = 'published') =>
      buildProgressSteps(req, trip(status)).at(-1);

    expect(last(request('rejected'))?.label).toBe('No aceptada');
    expect(last(request('rejected', { rejectionReason: 'trip_full' }))?.label).toBe(
      'Viaje completo',
    );
    expect(last(request('expired'))?.label).toBe('Caducada');
    expect(last(request('cancelled'))?.label).toBe('Cancelada');
    expect(last(request('cancelled', { rejectionReason: 'no_show' }))?.label).toBe(
      'No te presentaste',
    );
    expect(last(request('accepted'), 'cancelled')).toEqual(
      expect.objectContaining({ label: 'Viaje cancelado', state: 'stopped' }),
    );
  });

  it('shows the time of today, and the day for other days', () => {
    const now = new Date('2026-11-11T18:00:00Z');
    expect(formatStepTime('2026-11-11T12:03:00Z', now)).toMatch(/^\d\d:\d\d$/);
    expect(formatStepTime('2026-11-09T12:03:00Z', now)).toMatch(/9 nov/);
  });

  it('renders each step with its time and the current one for screen readers', () => {
    TestBed.configureTestingModule({ providers: [provideIonicAngular()] });
    const fixture = TestBed.createComponent(PassengerProgress);
    fixture.componentRef.setInput('request', request('accepted'));
    fixture.componentRef.setInput('trip', trip('in_progress'));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelectorAll('li')).toHaveLength(4);
    expect(root.querySelectorAll('time')).toHaveLength(2);
    expect(root.querySelector('[aria-current="step"]')?.textContent).toContain('En curso');
  });
});
