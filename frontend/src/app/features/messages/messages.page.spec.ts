import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Conversation } from '../../core/models/chat.model';
import { ChatService } from '../../core/services/chat/chat.service';
import { MessagesPage } from './messages.page';

const CONVERSATION: Conversation = {
  id: 't1',
  trip: {
    id: 't1',
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL',
    departureAt: '2026-11-04T06:00:00.000Z',
    status: 'confirmed',
  },
  myRole: 'driver',
  lastMessage: {
    id: 'm1',
    author: { id: 'u2', name: 'Pía R.', avatarKey: null },
    authorRole: 'passenger',
    kind: 'quick',
    text: null,
    quickReply: 'on_my_way',
    createdAt: new Date().toISOString(),
  },
  unreadCount: 2,
  isOpen: true,
};

describe('MessagesPage', () => {
  let listConversations: ReturnType<typeof vi.fn>;

  async function render(): Promise<{ root: HTMLElement; page: MessagesPage }> {
    TestBed.configureTestingModule({
      imports: [MessagesPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        { provide: ChatService, useValue: { listConversations } },
      ],
    });
    const fixture = TestBed.createComponent(MessagesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, page: fixture.componentInstance };
  }

  beforeEach(() => {
    listConversations = vi.fn().mockResolvedValue([CONVERSATION]);
  });

  it('lists each conversation with its route, last message and unread count', async () => {
    const { root } = await render();

    const row = root.querySelector('.conversation');
    expect(row?.getAttribute('href')).toBe('/tabs/messages/t1');
    expect(row?.classList).toContain('conversation--unread');
    expect(row?.textContent).toContain('Roquetas de Mar → Campus UAL');
    expect(row?.textContent).toContain('Pía R.: Estoy en camino');
    expect(row?.querySelector('.conversation__unread')?.textContent).toContain('2');
  });

  it('says when a conversation is closed and how to start one without messages', async () => {
    listConversations.mockResolvedValue([
      { ...CONVERSATION, lastMessage: null, unreadCount: 0, isOpen: false },
    ]);

    const { root } = await render();

    const row = root.querySelector('.conversation');
    expect(row?.textContent).toContain('Cerrada');
    expect(row?.textContent).toContain('Escribe el primer mensaje');
    expect(row?.querySelector('.conversation__unread')).toBeNull();
  });

  it('explains when there are no conversations yet', async () => {
    listConversations.mockResolvedValue([]);

    const { root } = await render();

    expect(root.textContent).toContain('Aún no tienes conversaciones');
  });

  it('offers to retry when they cannot be loaded, and reloads on entering', async () => {
    listConversations.mockRejectedValueOnce(new Error('offline'));
    const { root, page } = await render();
    expect(root.textContent).toContain('No hemos podido cargar tus mensajes');

    page.handleRetry();
    page.ionViewWillEnter();
    await vi.waitFor(() => expect(listConversations.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
