import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { NotificationsService } from './notifications.service';

describe('NotificationsService', () => {
  let notifications: NotificationsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    notifications = TestBed.inject(NotificationsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function countUnread(total: string): Promise<void> {
    const refresh = notifications.refreshUnread();
    http
      .expectOne('/api/users/me/notifications?isRead=false&limit=1')
      .flush([], { headers: { 'X-Total-Count': total } });
    await refresh;
  }

  it('lists my latest notifications', async () => {
    const list = notifications.list();
    http.expectOne('/api/users/me/notifications?limit=50').flush([{ id: 'n1' }]);

    expect(await list).toEqual([{ id: 'n1' }]);
  });

  it('counts the unread ones and keeps the count if it fails', async () => {
    await countUnread('3');
    expect(notifications.unreadCount()).toBe(3);

    const refresh = notifications.refreshUnread();
    http
      .expectOne('/api/users/me/notifications?isRead=false&limit=1')
      .flush(null, { status: 500, statusText: 'Server Error' });
    await refresh;

    expect(notifications.unreadCount()).toBe(3);
  });

  it('marks one as read and lowers the count', async () => {
    await countUnread('1');

    const read = notifications.markRead('n1');
    http.expectOne({ method: 'POST', url: '/api/notifications/n1/read' }).flush({ id: 'n1' });
    await read;

    expect(notifications.unreadCount()).toBe(0);
  });

  it('marks all as read', async () => {
    await countUnread('4');

    const read = notifications.markAllRead();
    http.expectOne({ method: 'POST', url: '/api/users/me/notifications/read' }).flush(null);
    await read;

    expect(notifications.unreadCount()).toBe(0);
  });

  it('turns API errors into ApiError', async () => {
    const read = notifications.markRead('n1');
    http
      .expectOne('/api/notifications/n1/read')
      .flush(
        { '@type': 'Error', code: 'NOTIFICATION_NOT_FOUND', status: '404' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(read).rejects.toBeInstanceOf(ApiError);
  });
});
