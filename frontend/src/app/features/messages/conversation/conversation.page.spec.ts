import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ModalController, provideIonicAngular } from '@ionic/angular';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ChatMessage, Conversation } from '../../../core/models/chat.model';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ChatService } from '../../../core/services/chat/chat.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { CHAT_POLL_INTERVAL_MS, ConversationPage } from './conversation.page';

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
  lastMessage: null,
  unreadCount: 0,
  isOpen: true,
};

function message(id: string, authorId: string, overrides: Partial<ChatMessage> = {}): ChatMessage {
  return {
    id,
    author: { id: authorId, name: authorId === 'me' ? 'Lucía C.' : 'Pía R.', avatarKey: null },
    authorRole: authorId === 'me' ? 'driver' : 'passenger',
    kind: 'text',
    text: `Mensaje ${id}`,
    quickReply: null,
    createdAt: '2026-11-03T07:05:00.000Z',
    ...overrides,
  };
}

describe('ConversationPage', () => {
  let chat: Record<string, ReturnType<typeof vi.fn>>;
  let showError: ReturnType<typeof vi.fn>;
  let showSuccess: ReturnType<typeof vi.fn>;
  let modalRole: string;
  let modalProps: { action: (reason: string) => Promise<void> } | null;
  let fixture: ComponentFixture<ConversationPage>;
  let page: ConversationPage;

  async function render(conversation: Conversation = CONVERSATION): Promise<HTMLElement> {
    chat['listConversations'].mockResolvedValue([conversation]);
    TestBed.configureTestingModule({
      imports: [ConversationPage],
      providers: [
        provideIonicAngular(),
        { provide: ChatService, useValue: chat },
        { provide: AuthService, useValue: { currentUser: signal({ id: 'me' } as User) } },
        { provide: ToastService, useValue: { showError, showSuccess } },
        {
          provide: ModalController,
          useValue: {
            create: vi.fn().mockImplementation(({ componentProps }) => {
              modalProps = componentProps;
              return Promise.resolve({
                present: () => Promise.resolve(),
                onDidDismiss: () => Promise.resolve({ role: modalRole }),
              });
            }),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ tripId: 't1' })) },
        },
      ],
    });
    fixture = TestBed.createComponent(ConversationPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    await page.ionViewWillEnter();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    showError = vi.fn();
    showSuccess = vi.fn();
    modalRole = 'confirm';
    modalProps = null;
    chat = {
      listConversations: vi.fn(),
      listMessages: vi.fn().mockResolvedValue([message('m1', 'u2'), message('m2', 'me')]),
      send: vi
        .fn()
        .mockImplementation((_tripId, input) =>
          Promise.resolve(message('m3', 'me', { ...input, kind: 'text' })),
        ),
      markRead: vi.fn().mockResolvedValue(undefined),
      reportMessage: vi.fn().mockResolvedValue(undefined),
    };
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('shows the messages, mine on the right, and marks the conversation as read', async () => {
    const root = await render();

    expect(root.textContent).toContain('Roquetas de Mar → Campus UAL');
    const bubbles = root.querySelectorAll('.bubble');
    expect(bubbles).toHaveLength(2);
    expect(bubbles[0].classList).not.toContain('bubble--mine');
    expect(bubbles[0].textContent).toContain('Pía R.');
    expect(bubbles[1].classList).toContain('bubble--mine');
    expect(bubbles[1].querySelector('.bubble__author')).toBeNull();
    expect(chat['markRead']).toHaveBeenCalledWith('t1');
  });

  it('asks for the new messages every 5 s and stops when leaving', async () => {
    await render();
    chat['listMessages'].mockResolvedValue([message('m3', 'u2')]);

    await vi.advanceTimersByTimeAsync(CHAT_POLL_INTERVAL_MS);

    expect(chat['listMessages']).toHaveBeenLastCalledWith('t1', 'm2');
    expect(page.messages().map(({ id }) => id)).toEqual(['m1', 'm2', 'm3']);
    expect(chat['markRead']).toHaveBeenCalledTimes(2);

    page.ionViewDidLeave();
    const calls = chat['listMessages'].mock.calls.length;
    await vi.advanceTimersByTimeAsync(CHAT_POLL_INTERVAL_MS * 2);
    expect(chat['listMessages']).toHaveBeenCalledTimes(calls);
  });

  it('skips a failed poll and does not repeat the messages it already has', async () => {
    await render();
    chat['listMessages'].mockRejectedValueOnce(new Error('offline'));
    await vi.advanceTimersByTimeAsync(CHAT_POLL_INTERVAL_MS);
    chat['listMessages'].mockResolvedValueOnce([message('m2', 'me')]);
    await vi.advanceTimersByTimeAsync(CHAT_POLL_INTERVAL_MS);

    expect(page.messages()).toHaveLength(2);
  });

  it('sends a text, trimmed, and clears the box', async () => {
    await render();
    expect(page.canSendText()).toBe(false);

    page.handleDraft('  Te espero en el portal  ');
    expect(page.canSendText()).toBe(true);
    await page.handleSendText();

    expect(chat['send']).toHaveBeenCalledWith('t1', { text: 'Te espero en el portal' });
    expect(page.draft()).toBe('');
    expect(page.messages().at(-1)?.id).toBe('m3');
  });

  it('sends a quick reply with one tap', async () => {
    const root = await render();

    const buttons = root.querySelectorAll<HTMLButtonElement>('.quick-reply');
    expect([...buttons].map((button) => button.textContent?.trim())).toEqual([
      'Ya estoy en el punto',
      'Llego 5 min tarde',
      'Estoy en camino',
      '¿Dónde estás?',
    ]);
    buttons[1].click();
    await vi.advanceTimersByTimeAsync(0);

    expect(chat['send']).toHaveBeenCalledWith('t1', { quickReply: 'running_late' });
  });

  it('keeps the draft and says so when sending fails', async () => {
    chat['send'].mockRejectedValue(new Error('offline'));
    await render();
    page.handleDraft('Hola');

    await page.handleSendText();

    expect(showError).toHaveBeenCalled();
    expect(page.draft()).toBe('Hola');
    expect(page.isSending()).toBe(false);
  });

  it('only offers quick replies to the driver while the trip is in progress', async () => {
    const root = await render({
      ...CONVERSATION,
      trip: { ...CONVERSATION.trip, status: 'in_progress' },
    });

    expect(root.textContent).toContain('Mientras conduces, solo respuestas rápidas.');
    expect(root.querySelector('ion-textarea')).toBeNull();
    expect(root.querySelectorAll('.quick-reply')).toHaveLength(4);
  });

  it('only lets a closed conversation be read', async () => {
    const root = await render({ ...CONVERSATION, isOpen: false });

    expect(root.textContent).toContain('La conversación está cerrada');
    expect(root.querySelector('.quick-reply')).toBeNull();
    expect(root.querySelector('ion-textarea')).toBeNull();
    expect(root.querySelectorAll('.bubble')).toHaveLength(2);
  });

  it('reports the message of someone else with a reason, only once', async () => {
    const root = await render();
    const flags = root.querySelectorAll<HTMLButtonElement>('.bubble__report');
    expect(flags).toHaveLength(1);
    expect(flags[0].getAttribute('aria-label')).toBe('Denunciar el mensaje de Pía R.');

    await page.handleReport(page.messages()[0]);
    await modalProps?.action('Me ha insultado');
    fixture.detectChanges();

    expect(chat['reportMessage']).toHaveBeenCalledWith('t1', 'm1', 'Me ha insultado');
    expect(showSuccess).toHaveBeenCalledWith('Mensaje denunciado. Lo revisaremos.');
    expect(root.querySelectorAll('.bubble__report')).toHaveLength(0);
  });

  it('keeps the flag when the report is cancelled', async () => {
    const root = await render();
    modalRole = 'cancel';

    await page.handleReport(page.messages()[0]);
    fixture.detectChanges();

    expect(showSuccess).not.toHaveBeenCalled();
    expect(root.querySelectorAll('.bubble__report')).toHaveLength(1);
  });

  it('offers to retry when the conversation cannot be loaded', async () => {
    chat['listMessages'].mockRejectedValueOnce(new Error('offline'));
    const root = await render();
    expect(root.textContent).toContain('No hemos podido cargar la conversación');

    await page.handleRetry();
    fixture.detectChanges();

    expect(root.querySelectorAll('.bubble')).toHaveLength(2);
  });
});
