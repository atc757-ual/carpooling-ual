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
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { TripShareService } from '../../../core/services/trips/trip-share.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { ConfirmService } from '../../../core/services/ui/confirm.service';
import { DriverTripActions } from './driver-trip-actions';
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

describe('DriverTripActions', () => {
  let fixture: ComponentFixture<DriverTripActions>;
  let driver: Record<string, ReturnType<typeof vi.fn>>;
  let toast: Record<string, ReturnType<typeof vi.fn>>;
  let ask: ReturnType<typeof vi.fn>;
  let tracking: Record<string, ReturnType<typeof vi.fn>>;
  let location: Record<string, ReturnType<typeof vi.fn>>;
  let share: ReturnType<typeof vi.fn>;
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
    share = vi.fn().mockResolvedValue('shared');
    TestBed.configureTestingModule({
      imports: [DriverTripActions],
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
        { provide: TripShareService, useValue: { share } },
      ],
    });
    fixture = TestBed.createComponent(DriverTripActions);
    fixture.componentRef.setInput('trip', trip);
    changed = 0;
    fixture.componentInstance.changed.subscribe(() => changed++);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

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

  it('shares the free seats with the route and the link to the web', async () => {
    const root = await render(TRIP);

    const button = [...root.querySelectorAll('ion-button')].find((candidate) =>
      candidate.textContent?.includes('Compartir plazas libres'),
    );
    expect(button).toBeDefined();
    await fixture.componentInstance.handleShareSeats();

    expect(share).toHaveBeenCalledWith({
      title: 'Plazas libres en Carpooling UAL',
      text: expect.stringContaining('Tengo 3 plazas libres en mi coche: Roquetas de Mar →'),
      url: globalThis.location.origin,
    });
  });

  it('shares the seats without the link from the native app', async () => {
    vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
    await render(TRIP);

    await fixture.componentInstance.handleShareSeats();

    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: undefined }));
    vi.restoreAllMocks();
  });

  it('only offers to share seats while the trip takes requests', async () => {
    await render({ ...TRIP, availableSeats: 0, status: 'confirmed' });
    expect(fixture.componentInstance.canShareSeats()).toBe(false);

    TestBed.resetTestingModule();
    await render({ ...TRIP, departureAt: new Date(Date.now() + 5 * 60 * 1000).toISOString() });
    expect(fixture.componentInstance.canShareSeats()).toBe(false);

    TestBed.resetTestingModule();
    await render({ ...TRIP, status: 'in_progress' });
    expect(fixture.componentInstance.canShareSeats()).toBe(false);
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
      expect(root.textContent).toContain('Disponible desde las');
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
      expect(root.textContent).not.toContain('Disponible desde');

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

  it('waits for a passenger before a published trip can start', async () => {
    const root = await render(TRIP);

    expect(root.textContent).toContain('Disponible cuando aceptes a algún pasajero');
    expect(root.querySelector('.notice--warning')).toBeNull();
  });

  it('warns about a late cancellation only with passengers and under 30 minutes', async () => {
    const root = await render({
      ...TRIP,
      status: 'confirmed',
      departureAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
    });

    expect(root.querySelector('.notice--warning')?.textContent).toContain(
      'contará como cancelación tardía',
    );
  });

  it('keeps the actions of a closed trip, disabled and with the reason', async () => {
    const root = await render({ ...TRIP, status: 'cancelled' });

    expect(fixture.componentInstance.closedReason()).toContain('se canceló');
    const buttons = [...root.querySelectorAll('ion-button')];
    expect(buttons).toHaveLength(2);
    expect(buttons[0].textContent).toContain('Iniciar viaje');
    expect(buttons[1].textContent).toContain('Cancelar viaje');
    expect(buttons.every((button) => button.hasAttribute('disabled'))).toBe(true);
    // El motivo, dentro de cada botón para el lector de pantalla
    expect(buttons.every((button) => button.textContent?.includes('se canceló'))).toBe(true);
  });
});
