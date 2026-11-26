import { ModalController } from '@ionic/angular';
import { vi } from 'vitest';
import { ConfirmService } from '../../core/services/ui/confirm.service';
import { askFinishTrip, openIncidentDialog } from './live-trip-dialogs';
import { PassengerIncidentModal } from './passenger-requests/passenger-incident-modal/passenger-incident-modal';

// Reportar y terminar el viaje en ventanas (escritorio)
describe('live trip dialogs', () => {
  const translate = (key: string, params?: Record<string, unknown>): string =>
    params ? `${key} ${JSON.stringify(params)}` : key;

  it('opens the incident form in a dialog and says whether it was sent', async () => {
    const dismissed = vi
      .fn()
      .mockResolvedValueOnce({ data: { reported: true } })
      .mockResolvedValueOnce({ data: undefined });
    const create = vi.fn().mockResolvedValue({
      present: () => Promise.resolve(),
      onWillDismiss: dismissed,
    });
    const modalController = { create } as unknown as ModalController;
    const props = { tripId: 't1', isDriver: true };

    expect(await openIncidentDialog(modalController, props)).toBe(true);
    expect(create).toHaveBeenCalledWith({
      component: PassengerIncidentModal,
      componentProps: props,
      cssClass: 'info-dialog',
    });
    expect(await openIncidentDialog(modalController, props)).toBe(false);
  });

  it('asks to finish, warning in amber with the distance when still far', async () => {
    const ask = vi.fn().mockResolvedValue(true);
    const confirm = { ask } as unknown as ConfirmService;

    expect(
      await askFinishTrip(confirm, { point: null, distance: null, isFar: false }, translate),
    ).toBe(true);
    expect(ask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        message: 'live.dejarasCompartirUbicacionViaje',
        confirmText: 'live.terminar',
        isWarning: false,
      }),
    );

    await askFinishTrip(confirm, { point: [0, 0], distance: 4200, isFar: true }, translate);
    const options = ask.mock.lastCall?.[0] as { message: string; confirmText: string };
    expect(options.message).toContain('live.stillFar');
    expect(options.message).toContain('live.terminasAhoraTusPasajeros');
    expect(options.confirmText).toBe('live.finishAnyway');
  });
});
