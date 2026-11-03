import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../models/api-error.model';
import { ChatService } from './chat.service';

describe('ChatService', () => {
  let chat: ChatService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    chat = TestBed.inject(ChatService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function expectUnreadQuery(total: string) {
    const request = http.expectOne((req) => req.url === '/api/users/me/conversations');
    expect(request.request.params.get('hasUnread')).toBe('true');
    expect(request.request.params.get('limit')).toBe('1');
    request.flush([], { headers: { 'X-Total-Count': total } });
  }

  it('knows whether there are new messages from X-Total-Count', async () => {
    const refreshing = chat.refreshUnread();
    expectUnreadQuery('2');
    await refreshing;
    expect(chat.hasUnread()).toBe(true);

    const again = chat.refreshUnread();
    expectUnreadQuery('0');
    await again;
    expect(chat.hasUnread()).toBe(false);
  });

  it('keeps the dot as it was when the check fails', async () => {
    const refreshing = chat.refreshUnread();
    http
      .expectOne((req) => req.url === '/api/users/me/conversations')
      .flush(null, { status: 500, statusText: 'Error' });
    await refreshing;
    expect(chat.hasUnread()).toBe(false);
  });

  it('lists the conversations and the messages, only the new ones with after', async () => {
    const conversations = chat.listConversations();
    http.expectOne((req) => req.url === '/api/users/me/conversations').flush([{ id: 't1' }]);
    await expect(conversations).resolves.toEqual([{ id: 't1' }]);

    const all = chat.listMessages('t1');
    const first = http.expectOne((req) => req.url === '/api/trips/t1/messages');
    expect(first.request.params.has('after')).toBe(false);
    first.flush([{ id: 'm1' }]);
    await expect(all).resolves.toEqual([{ id: 'm1' }]);

    const newer = chat.listMessages('t1', 'm1');
    const second = http.expectOne((req) => req.url === '/api/trips/t1/messages');
    expect(second.request.params.get('after')).toBe('m1');
    second.flush([]);
    await expect(newer).resolves.toEqual([]);
  });

  it('sends a message and marks the conversation as read', async () => {
    const sending = chat.send('t1', { quickReply: 'at_pickup' });
    const post = http.expectOne('/api/trips/t1/messages');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ quickReply: 'at_pickup' });
    post.flush({ id: 'm2' });
    await expect(sending).resolves.toEqual({ id: 'm2' });

    const reading = chat.markRead('t1');
    const put = http.expectOne('/api/trips/t1/messages/read');
    expect(put.request.method).toBe('PUT');
    put.flush(null, { status: 204, statusText: 'No Content' });
    await reading;
    // Después, vuelve a mirar si queda algo nuevo
    expectUnreadQuery('0');
  });

  it('reports a message with its reason', async () => {
    const reporting = chat.reportMessage('t1', 'm1', 'Me ha insultado');
    const post = http.expectOne('/api/trips/t1/messages/m1/report');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ reason: 'Me ha insultado' });
    post.flush({ id: 'i1' }, { status: 201, statusText: 'Created' });
    await expect(reporting).resolves.toBeUndefined();
  });

  it('throws an ApiError when a request fails', async () => {
    const sending = chat.send('t1', { text: 'Hola' });
    http
      .expectOne('/api/trips/t1/messages')
      .flush({ code: 'CHAT_CLOSED' }, { status: 409, statusText: 'Conflict' });
    await expect(sending).rejects.toBeInstanceOf(ApiError);
  });
});
