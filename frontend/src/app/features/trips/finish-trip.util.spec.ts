import { vi } from 'vitest';
import { DriverTrackingService } from '../../core/services/drivers/driver-tracking.service';
import { DriverService } from '../../core/services/drivers/driver.service';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { ToastService } from '../../core/services/ui/toast.service';
import { finishTrip, FinishTripDeps } from './finish-trip.util';

describe('finishTrip', () => {
  let ask: ReturnType<typeof vi.fn>;
  let finish: ReturnType<typeof vi.fn>;
  let stop: ReturnType<typeof vi.fn>;
  let toast: { showSuccess: ReturnType<typeof vi.fn>; showError: ReturnType<typeof vi.fn> };
  let deps: FinishTripDeps;

  beforeEach(() => {
    ask = vi.fn().mockResolvedValue(true);
    finish = vi.fn().mockResolvedValue({ id: 't1', status: 'finished' });
    stop = vi.fn();
    toast = { showSuccess: vi.fn(), showError: vi.fn() };
    deps = {
      confirm: { ask } as unknown as ConfirmService,
      driver: { finishTrip: finish } as unknown as DriverService,
      tracking: { stop } as unknown as DriverTrackingService,
      toast: toast as unknown as ToastService,
    };
  });

  it('confirms, finishes the trip and stops sharing the location', async () => {
    await expect(finishTrip(deps, 't1', 'icon')).resolves.toBe(true);

    expect(ask).toHaveBeenCalledWith(
      expect.objectContaining({ confirmText: 'Terminar', cancelText: 'Seguir en el viaje' }),
    );
    expect(finish).toHaveBeenCalledWith('t1');
    expect(stop).toHaveBeenCalled();
    expect(toast.showSuccess).toHaveBeenCalledWith('Viaje terminado. Gracias por compartir coche.');
  });

  it('keeps the trip when the confirmation is dismissed', async () => {
    ask.mockResolvedValue(false);

    await expect(finishTrip(deps, 't1', 'icon')).resolves.toBe(false);
    expect(finish).not.toHaveBeenCalled();
  });

  it('says so when finishing fails and keeps sharing', async () => {
    finish.mockRejectedValue(new Error('down'));

    await expect(finishTrip(deps, 't1', 'icon')).resolves.toBe(false);
    expect(stop).not.toHaveBeenCalled();
    expect(toast.showError).toHaveBeenCalled();
  });
});
