import { vi } from 'vitest';
import { DriverTrackingService } from '../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../core/services/drivers/driver.service';
import { LocationService } from '../../core/services/location/location.service';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { ToastService } from '../../core/services/ui/toast.service';
import { FinishableTrip, finishTrip, FinishTripDeps, formatDistance } from './finish-trip.util';

// Campus UAL y dos puntos: en el parking (unos 100 m) y en Almería centro
// (unos 5 km)
const TRIP: FinishableTrip = {
  id: 't1',
  destination: { type: 'Point', coordinates: [-2.4058, 36.8297] },
};
const NEAR: [number, number] = [-2.4065, 36.8303];
const FAR: [number, number] = [-2.4637, 36.8381];

describe('finishTrip', () => {
  let ask: ReturnType<typeof vi.fn>;
  let finish: ReturnType<typeof vi.fn>;
  let stop: ReturnType<typeof vi.fn>;
  let getCurrentPoint: ReturnType<typeof vi.fn>;
  let toast: { showSuccess: ReturnType<typeof vi.fn>; showError: ReturnType<typeof vi.fn> };
  let deps: FinishTripDeps;

  beforeEach(() => {
    ask = vi.fn().mockResolvedValue(true);
    finish = vi.fn().mockResolvedValue({ id: 't1', status: 'finished' });
    stop = vi.fn();
    getCurrentPoint = vi.fn().mockResolvedValue(NEAR);
    toast = { showSuccess: vi.fn(), showError: vi.fn() };
    deps = {
      confirm: { ask } as unknown as ConfirmService,
      driver: { finishTrip: finish } as unknown as DriverService,
      tracking: { stop } as unknown as DriverTrackingService,
      toast: toast as unknown as ToastService,
      location: { getCurrentPoint } as unknown as LocationService,
    };
  });

  it('confirms near the destination, finishes with the position and stops sharing', async () => {
    await expect(finishTrip(deps, TRIP, 'icon')).resolves.toBe(true);

    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({
        header: '¿Terminar el viaje?',
        confirmText: 'Terminar',
        cancelText: 'Seguir en el viaje',
        icon: 'icon',
      }),
    );
    expect(finish).toHaveBeenCalledWith('t1', NEAR);
    expect(stop).toHaveBeenCalled();
    expect(toast.showSuccess).toHaveBeenCalledWith('Viaje terminado. Gracias por compartir coche.');
  });

  it('warns in amber with the distance when the driver is far from the destination', async () => {
    getCurrentPoint.mockResolvedValue(FAR);

    await expect(finishTrip(deps, TRIP, 'icon')).resolves.toBe(true);

    const [options] = ask.mock.calls[0] as [{ message: string }];
    expect(options).toMatchObject({
      header: '¿Terminar lejos del destino?',
      confirmText: 'Terminar igualmente',
      cancelText: 'Seguir en el viaje',
      isDestructive: true,
      isWarning: true,
    });
    expect(options.message).toMatch(/^Aún estás a 5,\d km del destino\./);
    expect(finish).toHaveBeenCalledWith('t1', FAR);
  });

  it('asks as usual and finishes without a position when it is unknown', async () => {
    getCurrentPoint.mockRejectedValue(new Error('no gps'));

    await expect(finishTrip(deps, TRIP, 'icon')).resolves.toBe(true);

    expect(ask).toHaveBeenCalledWith(expect.objectContaining({ header: '¿Terminar el viaje?' }));
    expect(finish).toHaveBeenCalledWith('t1', null);
  });

  it('keeps the trip when the confirmation is dismissed', async () => {
    ask.mockResolvedValue(false);

    await expect(finishTrip(deps, TRIP, 'icon')).resolves.toBe(false);
    expect(finish).not.toHaveBeenCalled();
  });

  it('says so when finishing fails and keeps sharing', async () => {
    finish.mockRejectedValue(new Error('down'));

    await expect(finishTrip(deps, TRIP, 'icon')).resolves.toBe(false);
    expect(stop).not.toHaveBeenCalled();
    expect(toast.showError).toHaveBeenCalled();
  });
});

describe('formatDistance', () => {
  it.each([
    [250.4, '250 m'],
    [999, '999 m'],
    [2340, '2,3 km'],
    [5000, '5 km'],
  ])('shows %s metres as «%s»', (meters, text) => {
    expect(formatDistance(meters)).toBe(text);
  });
});
