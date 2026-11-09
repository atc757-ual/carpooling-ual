import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { ApiError } from '../../../core/models/api-error.model';
import { vi } from 'vitest';
import { DriverTrip } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { DriverTrackingService } from '../../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { ChatService } from '../../../core/services/chat/chat.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { DriverTripCard } from './driver-trip-card';
import { provideCatalogsForTests } from '../../../core/services/catalogs/catalogs.testing';

const TRIP: DriverTrip = {
  id: 't1',
  departureAt: '2099-01-15T06:40:00.000Z',
  offeredSeats: 3,
  availableSeats: 3,
  maxDetourMin: 10,
  vehicleId: 'v1',
  origin: { type: 'Point', coordinates: [-2.6, 36.76] },
  destination: { type: 'Point', coordinates: [-2.4045, 36.8322] },
  status: 'published',
  originName: 'Roquetas de Mar',
  destinationName: 'Campus UAL · Parking P1 (Sur)',
};

function request(status: SeatRequest['status'], isPriority = false): SeatRequest {
  return {
    id: `r-${status}`,
    trip: { id: 't1' },
    passenger: { id: 'p1', name: 'Mario Pérez' },
    status,
    isPriority,
    seats: 2,
    requestedAt: '2099-01-14T10:00:00.000Z',
    answeredAt: null,
    cancelledAt: null,
    vehiclePlate: null,
  };
}

describe('DriverTripCard', () => {
  let fixture: ComponentFixture<DriverTripCard>;
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let toast: Record<string, ReturnType<typeof vi.fn>>;
  let ask: ReturnType<typeof vi.fn>;
  let tracking: Record<string, ReturnType<typeof vi.fn>>;
  let location: Record<string, ReturnType<typeof vi.fn>>;
  let changed: number;

  async function render(trip: DriverTrip, requests: SeatRequest[] = []): Promise<HTMLElement> {
    driver = {
      listTripRequests: vi.fn().mockResolvedValue(requests),
      decideRequest: vi.fn().mockResolvedValue(request('accepted')),
      cancelTrip: vi.fn().mockResolvedValue({ ...TRIP, status: 'cancelled' }),
      startTrip: vi.fn().mockResolvedValue({ ...TRIP, status: 'in_progress' }),
      finishTrip: vi.fn().mockResolvedValue({ ...TRIP, status: 'finished' }),
    };
    toast = { showSuccess: vi.fn(), showError: vi.fn(), showInfo: vi.fn() };
    ask = vi.fn().mockResolvedValue(true);
    tracking = { start: vi.fn(), stop: vi.fn() };
    location = {
      checkDevicePermission: vi.fn().mockResolvedValue('granted'),
      getCurrentPoint: vi.fn().mockResolvedValue([-2.43, 36.83]),
    };
    TestBed.configureTestingModule({
      imports: [DriverTripCard],
      providers: [
        provideCatalogsForTests(),
        provideIonicAngular(),
        provideRouter([{ path: 'tabs/trips/drive/:id', children: [] }]),
        { provide: DriverService, useValue: driver },
        {
          provide: ChatService,
          useValue: {
            listContacts: vi
              .fn()
              .mockResolvedValue([
                { id: 'p1', name: 'Mario Pérez', phone: '+34600111222', role: 'passenger' },
              ]),
          },
        },
        { provide: ToastService, useValue: toast },
        { provide: ConfirmService, useValue: { ask } },
        { provide: DriverTrackingService, useValue: tracking },
        { provide: LocationService, useValue: location },
      ],
    });
    fixture = TestBed.createComponent(DriverTripCard);
    fixture.componentRef.setInput('trip', trip);
    changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the route, the status and the free seats', async () => {
    const root = await render(TRIP);

    expect(root.textContent).toContain('Roquetas de Mar → Campus UAL · Parking P1 (Sur)');
    expect(root.textContent).toContain('Publicado');
    expect(root.textContent).toContain('3 de 3 libres');
    expect(root.textContent).toContain('Aún no hay solicitudes');
    // Sin pasajeros aceptados aún no hay chat
    expect(root.querySelector('app-trip-chat-link')).toBeNull();
  });

  it('opens the chat of the trip once it has passengers', async () => {
    const confirmed = await render({ ...TRIP, status: 'confirmed' });
    expect(confirmed.querySelector('app-trip-chat-link')?.textContent).toContain('Chat del viaje');
  });

  it('names the places generically when the trip has no names', async () => {
    const root = await render({ ...TRIP, originName: null, destinationName: null });

    expect(root.textContent).toContain('Origen → Destino');
  });

  it('lists the pending and accepted requests, and hides the closed ones', async () => {
    const root = await render(TRIP, [
      request('pending', true),
      request('accepted'),
      request('rejected'),
    ]);

    expect(fixture.componentInstance.visibleRequests().map(({ status }) => status)).toEqual([
      'pending',
      'accepted',
    ]);
    expect(root.textContent).toContain('2 plazas · Prioridad');
    expect(root.textContent).toContain('Aceptada');
  });

  it('accepts a request and says so', async () => {
    await render(TRIP, [request('pending')]);

    await fixture.componentInstance.handleDecide(request('pending'), 'accept');

    expect(driver['decideRequest']).toHaveBeenCalledWith('r-pending', 'accept');
    expect(toast['showSuccess']).toHaveBeenCalledWith('Has aceptado la solicitud de Mario Pérez.');
    expect(changed).toBe(1);
    expect(fixture.componentInstance.deciding()).toBeNull();
  });

  it('shows the API error when the decision fails', async () => {
    await render(TRIP, [request('pending')]);
    driver['decideRequest'].mockRejectedValue(new Error('down'));

    await fixture.componentInstance.handleDecide(request('pending'), 'reject');

    expect(toast['showError']).toHaveBeenCalled();
    expect(changed).toBe(0);
  });

  it('confirms cancellation, cancels the trip and refreshes the list', async () => {
    await render(TRIP);

    await fixture.componentInstance.handleCancel();

    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        header: '¿Cancelar este viaje?',
        confirmText: 'Cancelar viaje',
        cancelText: 'Mantener viaje',
      }),
    );
    expect(driver['cancelTrip']).toHaveBeenCalledWith('t1');
    expect(toast['showSuccess']).toHaveBeenCalledWith(
      'Viaje cancelado. Hemos avisado a los pasajeros.',
    );
    expect(changed).toBe(1);
  });

  it('does not cancel when the confirmation is dismissed', async () => {
    await render(TRIP);
    ask.mockResolvedValue(false);

    await fixture.componentInstance.handleCancel();

    expect(driver['cancelTrip']).not.toHaveBeenCalled();
    expect(changed).toBe(0);
  });

  describe('start and finish', () => {
    // Confirmado y saliendo en 5 min: ya se puede iniciar
    const SOON: DriverTrip = {
      ...TRIP,
      status: 'confirmed',
      departureAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    };

    it('waits until 10 minutes before the departure', async () => {
      const root = await render({ ...TRIP, status: 'confirmed' });

      expect(fixture.componentInstance.canStart()).toBe(false);
      expect(root.textContent).toContain('Podrás iniciarlo desde las');
      await fixture.componentInstance.handleStart();
      expect(driver['startTrip']).not.toHaveBeenCalled();
    });

    it('does not start if the driver backs out of the confirmation', async () => {
      await render(SOON);
      ask.mockResolvedValue(false);

      await fixture.componentInstance.handleStart();

      expect(driver['startTrip']).not.toHaveBeenCalled();
    });

    it('starts sharing the location after confirming when the device already allows it', async () => {
      const root = await render(SOON);
      expect(root.textContent).not.toContain('Podrás iniciarlo');

      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);

      await fixture.componentInstance.handleStart();

      expect(ask).toHaveBeenCalledWith(
        expect.objectContaining({ header: '¿Iniciar el viaje?', confirmText: 'Iniciar viaje' }),
      );
      expect(location['getCurrentPoint']).not.toHaveBeenCalled();
      expect(driver['startTrip']).toHaveBeenCalledWith('t1');
      expect(tracking['start']).toHaveBeenCalledWith('t1');
      expect(changed).toBe(1);
      expect(navigate).toHaveBeenCalledWith('/tabs/trips/drive/t1');
    });

    // RF-21: al iniciar se confirma la declaración; si le toca renovarse
    // (cada año), se abre y, aceptada, se inicia
    it('says the start confirms the declarations and renews an expired one', async () => {
      await render(SOON);
      vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      vi.spyOn(TestBed.inject(ModalController), 'create').mockResolvedValue({
        present: vi.fn().mockResolvedValue(undefined),
        onWillDismiss: () => Promise.resolve({ role: 'accept' }),
      } as unknown as HTMLIonModalElement);
      driver['acceptDeclaration'] = vi.fn().mockResolvedValue({ hasLicenseDeclared: true });
      driver['startTrip'].mockRejectedValueOnce(new ApiError('DRIVER_DECLARATION_REQUIRED', 409));

      await fixture.componentInstance.handleStart();

      expect(ask).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('confirmas que sigues cumpliendo') as string,
        }),
      );
      expect(driver['acceptDeclaration']).toHaveBeenCalled();
      expect(driver['startTrip']).toHaveBeenCalledTimes(2);
      expect(tracking['start']).toHaveBeenCalledWith('t1');
    });

    // Es parte del servicio (RGPD 6.1.b): se informa y se pide el permiso del
    // dispositivo, pero no se registra un consentimiento
    it('explains that sharing is part of the service and only asks for the device permission', async () => {
      await render(SOON);
      location['checkDevicePermission'].mockResolvedValue('prompt');

      await fixture.componentInstance.handleStart();

      expect(ask).toHaveBeenCalledWith(
        expect.objectContaining({
          header: 'Compartirás tu ubicación',
          confirmText: 'Iniciar viaje',
          cancelText: 'Ahora no',
          message: expect.stringContaining('Es parte del servicio') as string,
        }),
      );
      expect(location['getCurrentPoint']).toHaveBeenCalledWith('driving');
      expect(driver['startTrip']).toHaveBeenCalledWith('t1');
    });

    it('says in the app that it keeps sharing with the screen locked', async () => {
      const isNative = vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
      await render(SOON);
      location['checkDevicePermission'].mockResolvedValue('prompt');

      await fixture.componentInstance.handleStart();

      const [options] = ask.mock.calls[0] as [{ message: string }];
      expect(options.message).toContain(
        'Seguirá compartiéndose aunque bloquees la pantalla o uses otra app; lo verás en una notificación.',
      );
      isNative.mockRestore();
    });

    it('does not start without sharing the location', async () => {
      await render(SOON);
      location['checkDevicePermission'].mockResolvedValue('prompt');
      ask.mockResolvedValue(false);

      await fixture.componentInstance.handleStart();

      expect(location['getCurrentPoint']).not.toHaveBeenCalled();
      expect(driver['startTrip']).not.toHaveBeenCalled();
    });

    it('explains that the device permission is needed', async () => {
      await render(SOON);
      location['checkDevicePermission'].mockResolvedValue('denied');
      location['getCurrentPoint'].mockRejectedValue(new LocationError('denied'));

      await fixture.componentInstance.handleStart();

      expect(toast['showError']).toHaveBeenCalledWith(
        'Sin permiso de ubicación no puedes iniciar el viaje. Actívalo en los ajustes del móvil.',
      );
      expect(driver['startTrip']).not.toHaveBeenCalled();
    });

    it('shows the error when the location or the start fails', async () => {
      await render(SOON);
      location['checkDevicePermission'].mockResolvedValue('prompt');
      location['getCurrentPoint'].mockRejectedValueOnce(new Error('down'));
      await fixture.componentInstance.handleStart();
      driver['startTrip'].mockRejectedValue(new Error('down'));
      location['checkDevicePermission'].mockResolvedValue('granted');
      await fixture.componentInstance.handleStart();

      expect(toast['showError']).toHaveBeenCalledTimes(2);
      expect(tracking['start']).not.toHaveBeenCalled();
      expect(fixture.componentInstance.isChangingStatus()).toBe(false);
    });

    it('keeps sharing the location of a trip in progress and finishes it', async () => {
      const root = await render({ ...TRIP, status: 'in_progress' });
      expect(root.textContent).toContain('Compartiendo tu ubicación con tus pasajeros');
      expect(tracking['start']).toHaveBeenCalledWith('t1');

      await fixture.componentInstance.handleFinish();

      // A unos 2 km del destino: avisa antes de terminar
      expect(ask).toHaveBeenCalledWith(
        expect.objectContaining({
          confirmText: 'Terminar igualmente',
          cancelText: 'Seguir en el viaje',
          isWarning: true,
        }),
      );
      expect(driver['finishTrip']).toHaveBeenCalledWith('t1', [-2.43, 36.83]);
      expect(tracking['stop']).toHaveBeenCalled();
      expect(changed).toBe(1);
    });

    it('keeps the trip in progress when finishing is dismissed or fails', async () => {
      await render({ ...TRIP, status: 'in_progress' });
      ask.mockResolvedValueOnce(false);
      await fixture.componentInstance.handleFinish();
      driver['finishTrip'].mockRejectedValue(new Error('down'));
      await fixture.componentInstance.handleFinish();

      expect(driver['finishTrip']).toHaveBeenCalledTimes(1);
      expect(tracking['stop']).not.toHaveBeenCalled();
      expect(toast['showError']).toHaveBeenCalled();
    });
  });

  it('does not load requests of a finished trip', async () => {
    const root = await render({ ...TRIP, status: 'finished' });

    expect(driver['listTripRequests']).not.toHaveBeenCalled();
    expect(root.textContent).toContain('Finalizado');
    expect(root.querySelector('.driver-trip__requests')).toBeNull();
  });

  it('renders call button for accepted passenger and calls passenger when tapped', async () => {
    const root = await render({ ...TRIP, status: 'confirmed' }, [request('accepted')]);
    const tripCall = TestBed.inject(TripCallService);
    const openPhoneSpy = vi.spyOn(tripCall, 'openPhone').mockImplementation(() => undefined);

    const callBtn = root.querySelector('.driver-trip__call-btn');
    expect(callBtn).not.toBeNull();
    expect(callBtn?.getAttribute('title')).toBe('Llamar a Mario Pérez');
    expect(callBtn?.classList).not.toContain('driver-trip__call-btn--unavailable');

    fixture.componentInstance.handleCallPassenger({ id: 'p1', name: 'Mario Pérez' });
    expect(openPhoneSpy).toHaveBeenCalledWith('+34600111222');
  });

  it('shows call button as unavailable when trip is published', async () => {
    const root = await render({ ...TRIP, status: 'published' }, [request('accepted')]);

    const callBtn = root.querySelector('.driver-trip__call-btn');
    expect(callBtn).not.toBeNull();
    expect(callBtn?.classList).toContain('driver-trip__call-btn--unavailable');

    fixture.componentInstance.handleCallPassenger({ id: 'p1', name: 'Mario Pérez' });
    expect(toast['showInfo']).toHaveBeenCalledWith(
      'Solo se puede llamar con el viaje confirmado o en curso.',
    );
  });
});
