import { Router } from '@angular/router';
import { vi } from 'vitest';
import { AuthService } from '../../core/services/auth/auth.service';
import { ActiveModeService } from '../../core/services/users/active-mode.service';
import { openNotificationTarget } from './notification-target';

describe('openNotificationTarget', () => {
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

    expect(navigateByUrl).toHaveBeenNthCalledWith(1, '/tabs/messages/t1');
    expect(navigateByUrl).toHaveBeenNthCalledWith(2, '/tabs/messages');
  });

  it('opens the passenger request in passenger mode, replacing the page when it comes from a push', async () => {
    await openNotificationTarget(deps(), { type: 'request_accepted', requestId: 'r1' }, true);

    expect(setMode).toHaveBeenCalledWith('passenger');
    expect(navigateByUrl).toHaveBeenCalledWith('/tabs/trips/requests/r1', { replaceUrl: true });
  });

  it('opens Avisos for incidents and unknown types', async () => {
    await openNotificationTarget(deps(), { type: 'incident_reported' });
    await openNotificationTarget(deps(), { type: 'something_new' });

    expect(navigateByUrl).toHaveBeenCalledTimes(2);
    expect(navigateByUrl).toHaveBeenLastCalledWith('/tabs/notifications');
  });
});
