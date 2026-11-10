import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { provideIonicAngular } from '@ionic/angular';
import { vi } from 'vitest';
import { Conversation } from '../../core/models/chat.model';
import { User } from '../../core/models/user.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { ChatService } from '../../core/services/chat/chat.service';
import { formatTime } from '../matching/trip-results';
import { MessagesPage } from './messages.page';

const CONVERSATION: Conversation = {
  id: 't1',
  trip: {
    id: 't1',
    originName: 'Roquetas de Mar',
    destinationName: 'Campus UAL',
    departureAt: '2026-11-04T06:00:00.000Z',
    status: 'confirmed',
    driverName: 'Lucía Cortés',
    driverAvatarKey: null,
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
  let listConversationsPage: ReturnType<typeof vi.fn>;
  const unreadConversationCount = signal(2);
  const lastRead = signal<{ tripId: string } | null>(null);

  async function render(): Promise<{
    root: HTMLElement;
    page: MessagesPage;
    fixture: ComponentFixture<MessagesPage>;
  }> {
    TestBed.configureTestingModule({
      imports: [MessagesPage],
      providers: [
        provideIonicAngular(),
        provideRouter([]),
        {
          provide: ChatService,
          useValue: { listConversationsPage, unreadConversationCount, lastRead },
        },
        { provide: AuthService, useValue: { currentUser: signal({ id: 'me' } as User) } },
      ],
    });
    const fixture = TestBed.createComponent(MessagesPage);
    fixture.detectChanges();
    await vi.waitFor(() => expect(fixture.componentInstance.isLoading()).toBe(false));
    fixture.detectChanges();
    return { root: fixture.nativeElement as HTMLElement, page: fixture.componentInstance, fixture };
  }

  beforeEach(() => {
    unreadConversationCount.set(2);
    listConversationsPage = vi.fn().mockResolvedValue({ items: [CONVERSATION], total: 1 });
  });

  it('lists each conversation with its time, destination, last message and unread count', async () => {
    const { root } = await render();

    const row = root.querySelector('.conversation');
    expect(row?.tagName).toBe('BUTTON');
    expect(row?.classList).toContain('conversation--unread');
    // La hora en la zona del navegador (el CI va en UTC)
    expect(row?.textContent).toContain(`${formatTime(CONVERSATION.trip.departureAt)} · Campus UAL`);
    // El origen y quien conduce se ven al abrir el chat
    expect(row?.textContent).not.toContain('Roquetas de Mar');
    expect(row?.textContent).toContain('Pía R.: Estoy en camino');
    expect(row?.querySelector('.conversation__unread')?.textContent).toContain('2');
    // Con mensajes sin leer, la burbuja en lugar del estado del viaje
    expect(row?.querySelector('.status')).toBeNull();
    expect(root.querySelector('.messages__layout')).not.toBeNull();
    expect(root.querySelector('.messages__unread-summary')?.textContent).toContain(
      '2 conversaciones sin leer',
    );
  });

  it('shows the status of the trip and how to start a conversation without messages', async () => {
    listConversationsPage.mockResolvedValue({
      items: [
        {
          ...CONVERSATION,
          trip: { ...CONVERSATION.trip, status: 'cancelled' },
          lastMessage: null,
          unreadCount: 0,
          isOpen: false,
        },
      ],
      total: 1,
    });

    const { root } = await render();

    const row = root.querySelector('.conversation');
    expect(row?.querySelector('.status')?.textContent).toContain('Cancelado');
    expect(row?.textContent).toContain('Escribe el primer mensaje');
    expect(row?.querySelector('.conversation__unread')).toBeNull();
  });

  it('says «Tú» when the last message is mine, and colours a trip in progress', async () => {
    listConversationsPage.mockResolvedValue({
      items: [
        {
          ...CONVERSATION,
          trip: { ...CONVERSATION.trip, status: 'in_progress' },
          lastMessage: {
            ...(CONVERSATION.lastMessage as NonNullable<Conversation['lastMessage']>),
            author: { id: 'me', name: 'Lucía C.', avatarKey: null },
          },
          unreadCount: 0,
        },
      ],
      total: 1,
    });

    const { root } = await render();

    const row = root.querySelector('.conversation');
    expect(row?.textContent).toContain('Tú: Estoy en camino');
    expect(row?.querySelector('.status')?.classList).toContain('status--info');
  });

  it('explains when there are no conversations yet', async () => {
    listConversationsPage.mockResolvedValue({ items: [], total: 0 });

    const { root } = await render();

    expect(root.textContent).toContain('Aún no tienes conversaciones');
  });

  it('offers to retry when they cannot be loaded, and reloads on entering', async () => {
    listConversationsPage.mockRejectedValueOnce(new Error('offline'));
    const { root, page } = await render();
    expect(root.textContent).toContain('No hemos podido cargar tus mensajes');

    await page.handleRetry();
    page.ionViewWillEnter();
    await vi.waitFor(() =>
      expect(listConversationsPage.mock.calls.length).toBeGreaterThanOrEqual(2),
    );
  });

  it('filters unread conversations through the API and shows an empty filtered state', async () => {
    listConversationsPage.mockResolvedValue({ items: [], total: 0 });
    const { root, page, fixture } = await render();

    await page.handleFilter(true);
    fixture.detectChanges();

    expect(listConversationsPage).toHaveBeenLastCalledWith({
      offset: 0,
      limit: 10,
      hasUnread: true,
    });
    expect(root.textContent).toContain('No tienes mensajes sin leer');
  });

  it('loads another ten conversations when asking to see more', async () => {
    const firstPage = Array.from({ length: 10 }, (_, index) => ({
      ...CONVERSATION,
      id: `t${index + 1}`,
      trip: { ...CONVERSATION.trip, id: `t${index + 1}` },
    }));
    const secondPage = Array.from({ length: 3 }, (_, index) => ({
      ...CONVERSATION,
      id: `t${index + 11}`,
      trip: { ...CONVERSATION.trip, id: `t${index + 11}` },
    }));
    listConversationsPage.mockResolvedValueOnce({ items: firstPage, total: 13 });
    const { root, page, fixture } = await render();
    listConversationsPage.mockResolvedValueOnce({ items: secondPage, total: 13 });

    await page.handleLoadMore();
    fixture.detectChanges();

    expect(listConversationsPage).toHaveBeenLastCalledWith({
      offset: 10,
      limit: 10,
      hasUnread: undefined,
    });
    expect(page.all()).toHaveLength(13);
    expect(root.textContent).toContain('13 de 13 conversaciones');
  });

  it('does not request more conversations while loading or after the last page', async () => {
    const { page } = await render();
    listConversationsPage.mockClear();

    await page.handleLoadMore();

    expect(listConversationsPage).not.toHaveBeenCalled();
  });

  it('selects the conversation in the desktop detail panel without navigating', async () => {
    const { page } = await render();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    page.isDesktop.set(true);
    const event = new MouseEvent('click', { cancelable: true });

    await page.handleSelectConversation(event, 't1');

    expect(event.defaultPrevented).toBe(true);
    expect(page.selectedConversationId()).toBe('t1');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears the unread count of the conversation just read, without reloading', async () => {
    const { root, page, fixture } = await render();
    const calls = listConversationsPage.mock.calls.length;

    lastRead.set({ tripId: 't1' });
    fixture.detectChanges();

    expect(page.all().find(({ id }) => id === 't1')?.unreadCount).toBe(0);
    expect(root.querySelector('.conversation--unread')).toBeNull();
    expect(listConversationsPage.mock.calls).toHaveLength(calls);
    lastRead.set(null);
  });

  it('navigates to the full-screen conversation on mobile', async () => {
    const { page } = await render();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    page.isDesktop.set(false);

    await page.handleSelectConversation(new MouseEvent('click'), 't1');

    expect(navigate).toHaveBeenCalledWith(['/tabs/messages', 't1']);
  });
});
