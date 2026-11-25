import { initAppTranslations } from '../../core/i18n/testing-transloco';
import { Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../core/services/auth/auth.service';
import { ActiveModeService } from '../../core/services/users/active-mode.service';
import { openNotificationTarget } from './notification-target';

describe('openNotificationTarget', () => {
  beforeEach(() => initAppTranslations());

  let navigateByUrl: ReturnType<typeof vi.fn>;
  let setMode: ReturnType<typeof vi.fn>;
  let mode: string | null;

  const deps = () => ({
    router: { navigateByUrl } as unknown as Router,
    auth: { hasProfile: () => true } as unknown as AuthService,
    activeMode: { mode: () => mode, setMode } as unknown as ActiveModeService,
  });

  beforeEach(() => {
    navigateByUrl = vi.fn().mockResolvedValue(true);
    setMode = vi.fn().mockResolvedValue(undefined);
    mode = 'driver';
  });

  it('opens the trip chat for a chat message, or Mensajes without a trip', async () => {
    await openNotificationTarget(deps(), { type: 'chat_message', tripId: 't1' });
    await openNotificationTarget(deps(), { type: 'chat_message' });
    await openNotificationTarget(deps(), {
      type: 'chat_message',
      tripId: 't1',
      passengerId: 'p1',
    });

    expect(navigateByUrl).toHaveBeenNthCalledWith(1, '/tabs/messages/t1');
    expect(navigateByUrl).toHaveBeenNthCalledWith(2, '/tabs/messages');
    // El chat es directo: la conversación con ese pasajero
    expect(navigateByUrl).toHaveBeenNthCalledWith(3, '/tabs/messages/t1/p1');
  });

  it('opens the passenger request in passenger mode, replacing the page when it comes from a push', async () => {
    await openNotificationTarget(deps(), { type: 'request_accepted', requestId: 'r1' }, true);

    expect(setMode).toHaveBeenCalledWith('passenger');
    expect(navigateByUrl).toHaveBeenCalledWith('/tabs/trips/requests/r1', { replaceUrl: true });
  });

  it('opens the trip of the driver in driver mode, or Tus viajes without it', async () => {
    mode = 'passenger';
    await openNotificationTarget(deps(), { type: 'request_received', tripId: 't1' });
    await openNotificationTarget(deps(), { type: 'passenger_left' });

    expect(setMode).toHaveBeenCalledWith('driver');
    expect(navigateByUrl).toHaveBeenNthCalledWith(1, '/tabs/trips/published/t1');
    expect(navigateByUrl).toHaveBeenNthCalledWith(2, '/tabs/trips');
  });

  it('opens Avisos for the admin incident notices and unknown types', async () => {
    await openNotificationTarget(deps(), { type: 'incident_reported', incidentId: 'i1' });
    await openNotificationTarget(deps(), { type: 'something_new' });

    expect(navigateByUrl).toHaveBeenCalledTimes(2);
    expect(navigateByUrl).toHaveBeenLastCalledWith('/tabs/notifications');
  });

  it('opens my report in Help and support from the notice of its progress', async () => {
    await openNotificationTarget(deps(), { type: 'incident_reviewed', incidentId: 'i1' }, true);

    expect(setMode).not.toHaveBeenCalled();
    expect(navigateByUrl).toHaveBeenCalledWith('/tabs/profile/help?incident=i1', {
      replaceUrl: true,
    });
  });
});
