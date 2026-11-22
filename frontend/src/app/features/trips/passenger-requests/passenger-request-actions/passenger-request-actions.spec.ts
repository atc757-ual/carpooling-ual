import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { provideAppTransloco } from '../../../../core/i18n/testing-transloco';
import { ApiError, NETWORK_ERROR } from '../../../../core/models/api-error.model';
import { Trip } from '../../../../core/models/driver.model';
import { SeatRequest } from '../../../../core/models/seat-request.model';
import { SeatRequestsService } from '../../../../core/services/requests/seat-requests.service';
import { ConfirmService } from '../../../../core/services/ui/confirm.service';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { TripSearchStateService } from '../../../matching/trip-search-state.service';
import { PassengerRequestActions } from './passenger-request-actions';

const HOUR_MS = 60 * 60 * 1000;

function trip(status: Trip['status'], changes: Partial<Trip> = {}): Trip {
  return {
    id: 't1',
    status,
    departureAt: new Date(Date.now() + 2 * HOUR_MS).toISOString(),
    driver: { name: 'Lucía Martín' },
    origin: { type: 'Point', coordinates: [-2.46, 36.84] },
    originName: 'Calle Lachambre, 4',
    destinationName: 'Parking P1',
    ...changes,
  } as Trip;
}

function request(status: SeatRequest['status'], changes: Partial<SeatRequest> = {}): SeatRequest {
  return {
    id: 'r1',
    status,
    seats: 1,
    direction: 'to-campus',
    rejectionReason: null,
    pickupName: null,
    pickupLocation: null,
    ...changes,
  } as SeatRequest;
}

describe('PassengerRequestActions', () => {
  let fixture: ComponentFixture<PassengerRequestActions>;
  const cancel = vi.fn();
  const ask = vi.fn();
  const showSuccess = vi.fn().mockResolvedValue(undefined);
  const showError = vi.fn().mockResolvedValue(undefined);
  const setSearch = vi.fn();

  function create(seatRequest: SeatRequest, seatTrip: Trip): PassengerRequestActions {
    TestBed.configureTestingModule({
      providers: [
        provideIonicAngular(),
        provideAppTransloco(),
        provideRouter([]),
        { provide: SeatRequestsService, useValue: { cancel } },
        { provide: ConfirmService, useValue: { ask } },
        { provide: ToastService, useValue: { showSuccess, showError } },
        { provide: ModalController, useValue: { create: vi.fn() } },
        { provide: TripSearchStateService, useValue: { set: setSearch } },
      ],
    });
    fixture = TestBed.createComponent(PassengerRequestActions);
    fixture.componentRef.setInput('request', seatRequest);
    fixture.componentRef.setInput('trip', seatTrip);
    return fixture.componentInstance;
  }

  beforeEach(() => vi.clearAllMocks());

  it('lets a pending request be cancelled at no cost', () => {
    const actions = create(request('pending'), trip('published'));
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(actions.canCancel()).toBe(true);
    expect(actions.cancelLabel()).toBe('Cancelar solicitud');
    expect(actions.cancelCost()).toBe('Puedes cancelarla sin coste.');
    expect(actions.closedReason()).toBeNull();
    expect(root.querySelector('ion-button[type="submit"]')?.textContent).toContain(
      'Cancelar solicitud',
    );
  });

  it('says until when an accepted seat is free to cancel, and when it is late', () => {
    const early = create(request('accepted'), trip('confirmed'));
    expect(early.cancelLabel()).toBe('Cancelar mi plaza');
    expect(early.cancellationIsLate()).toBe(false);
    expect(early.cancelCost()).toContain('Sin coste hasta las');
    expect(early.hasChat()).toBe(true);

    TestBed.resetTestingModule();
    const late = create(
      request('accepted'),
      trip('confirmed', { departureAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() }),
    );
    expect(late.cancellationIsLate()).toBe(true);
    expect(late.cancelCost()).toBeNull();
  });

  it('only offers the incident report while the trip is in progress', () => {
    const actions = create(request('accepted'), trip('in_progress'));

    expect(actions.isTripInProgress()).toBe(true);
    expect(actions.canCancel()).toBe(false);
    expect(actions.closedReason()).toBeNull();
    expect(actions.hasContent()).toBe(true);
  });

  it.each([
    [request('rejected', { rejectionReason: 'trip_full' }), trip('published'), 'completó todas'],
    [request('cancelled', { rejectionReason: 'no_show' }), trip('confirmed'), 'no te presentaste'],
    [request('accepted'), trip('finished'), 'Este viaje ya terminó.'],
  ])('explains why a closed request can no longer be cancelled', (seatRequest, seatTrip, text) => {
    const actions = create(seatRequest, seatTrip);

    expect(actions.canCancel()).toBe(false);
    expect(actions.closedReason()).toContain(text);
  });

  it.each([
    [0, false],
    [31, true],
  ])(
    'when the driver cancelled %i min ago, offers its own search: %s (before, the card on top does)',
    (minutesAgo, canSearch) => {
      const cancelledByDriver = request('cancelled', {
        rejectionReason: 'trip_cancelled',
        cancelledAt: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
      });

      expect(create(cancelledByDriver, trip('cancelled')).canSearchAnother()).toBe(canSearch);
    },
  );

  it('offers a priority search with the same route when the request did not go ahead', async () => {
    const actions = create(
      request('rejected', { pickupName: 'Avenida del Mediterráneo, 120', seats: 2 }),
      trip('published'),
    );
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

    expect(actions.canSearchAnother()).toBe(true);
    actions.handlePrioritySearch();

    expect(setSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        direction: 'to-campus',
        place: expect.objectContaining({ name: 'Avenida del Mediterráneo, 120' }),
        seats: 2,
      }),
    );
    expect(navigate).toHaveBeenCalledWith('/tabs/search');
  });

  it('cancels after confirming it and tells who is listening', async () => {
    const seatRequest = request('pending');
    const actions = create(seatRequest, trip('published'));
    const cancelled = vi.fn();
    actions.cancelled.subscribe(cancelled);
    ask.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    cancel.mockResolvedValue({ ...seatRequest, status: 'cancelled' });

    await actions.handleCancel();
    expect(cancel).not.toHaveBeenCalled();

    await actions.handleCancel();
    expect(cancel).toHaveBeenCalledWith('r1');
    expect(cancelled).toHaveBeenCalledWith(expect.objectContaining({ status: 'cancelled' }));
    expect(showSuccess).toHaveBeenCalledWith('Solicitud cancelada.');
    expect(actions.isCancelling()).toBe(false);
  });

  it('shows the error when cancelling fails', async () => {
    const actions = create(request('pending'), trip('published'));
    ask.mockResolvedValue(true);
    cancel.mockRejectedValue(new ApiError(NETWORK_ERROR, 0));

    await actions.handleCancel();

    expect(showError).toHaveBeenCalled();
    expect(actions.isCancelling()).toBe(false);
  });

  it('only warns its screen of an inline incident, without opening a window', async () => {
    const actions = create(request('accepted'), trip('in_progress'));
    fixture.componentRef.setInput('inlineIncident', true);
    const requested = vi.fn();
    actions.incidentRequested.subscribe(requested);

    await actions.openIncidentModal();

    expect(requested).toHaveBeenCalled();
    expect(TestBed.inject(ModalController).create).not.toHaveBeenCalled();
  });
});
