import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { ActionSheetController, ModalController, provideIonicAngular } from '@ionic/angular';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ChatMessage, Conversation } from '../../../core/models/chat.model';
import { User } from '../../../core/models/user.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ChatService } from '../../../core/services/chat/chat.service';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
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
    driverName: 'Lucía Cortés',
    driverAvatarKey: null,
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
  let showInfo: ReturnType<typeof vi.fn>;
  let sheetButtons: { text: string; handler?: () => void }[];
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
        { provide: ToastService, useValue: { showError, showSuccess, showInfo } },
        {
          provide: ActionSheetController,
          useValue: {
            create: vi.fn().mockImplementation(({ buttons }) => {
              sheetButtons = buttons;
              return Promise.resolve({ present: () => Promise.resolve() });
            }),
          },
        },
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
    showInfo = vi.fn();
    sheetButtons = [];
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
      reportChat: vi.fn().mockResolvedValue(undefined),
      listContacts: vi.fn().mockResolvedValue([]),
    };
  });

  afterEach(() => {
    fixture?.destroy();
    vi.useRealTimers();
  });

  it('shows the messages, mine on the right, and marks the conversation as read', async () => {
    const root = await render();

    const places = root.querySelectorAll('.conversation__place-name');
    expect([...places].map((place) => place.textContent?.trim())).toEqual([
      'Roquetas de Mar',
      'Campus UAL',
    ]);
    expect(root.textContent).toContain('Conduce Lucía Cortés');
    expect(root.querySelector('.conversation__trip-status')?.textContent).toContain('Confirmado');
    // Un separador por día, como en las apps de mensajería
    expect(root.querySelectorAll('.conversation__day')).toHaveLength(1);
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

  it('does not poll after a failed initial load and starts again after retry', async () => {
    chat['listMessages'].mockRejectedValueOnce(new Error('offline'));
    await render();
    expect(page.hasError()).toBe(true);

    await vi.advanceTimersByTimeAsync(CHAT_POLL_INTERVAL_MS * 2);
    expect(chat['listMessages']).toHaveBeenCalledTimes(1);

    await page.handleRetry();
    expect(page.hasError()).toBe(false);
    await vi.advanceTimersByTimeAsync(CHAT_POLL_INTERVAL_MS);

    expect(chat['listMessages']).toHaveBeenLastCalledWith('t1', 'm2');
  });

  it('pauses polling in the background and checks for messages on return', async () => {
    await render();
    const hiddenDescriptor = Object.getOwnPropertyDescriptor(document, 'hidden');

    try {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(CHAT_POLL_INTERVAL_MS * 2);
      expect(chat['listMessages']).toHaveBeenCalledTimes(1);

      Object.defineProperty(document, 'hidden', { configurable: true, value: false });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(0);
      expect(chat['listMessages']).toHaveBeenLastCalledWith('t1', 'm2');
      await vi.advanceTimersByTimeAsync(CHAT_POLL_INTERVAL_MS);
      expect(chat['listMessages']).toHaveBeenCalledTimes(3);
    } finally {
      if (hiddenDescriptor) {
        Object.defineProperty(document, 'hidden', hiddenDescriptor);
      }
    }
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
      'Estoy en camino',
      'Llego 5 min tarde',
      'Ya estoy en el punto',
      'Te espero 2 min más',
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
    expect(root.querySelectorAll('.quick-reply')).toHaveLength(7);
  });

  it('offers the quick replies of the passenger to a passenger', async () => {
    const root = await render({ ...CONVERSATION, myRole: 'passenger' });
    const texts = [...root.querySelectorAll('.quick-reply')].map((button) =>
      button.textContent?.trim(),
    );

    expect(texts).toContain('Ya voy para allá');
    expect(texts).not.toContain('Estoy en camino');
  });

  it('only lets a closed conversation be read', async () => {
    const root = await render({ ...CONVERSATION, isOpen: false });

    expect(root.textContent).toContain('La conversación está cerrada');
    expect(root.querySelector('.quick-reply')).toBeNull();
    expect(root.querySelector('ion-textarea')).toBeNull();
    expect(root.querySelectorAll('.bubble')).toHaveLength(2);
  });

  it('opens options popover with report option and reports the chat with a reason', async () => {
    const root = await render();
    expect(root.querySelector('.conversation__options')).not.toBeNull();
    expect(root.querySelector('.bubble__report')).toBeNull();

    expect(page.isOptionsOpen()).toBe(false);
    const optionsBtn = root.querySelector<HTMLButtonElement>('.conversation__options');
    optionsBtn?.click();
    expect(page.isOptionsOpen()).toBe(true);
    expect(page.optionsEvent).not.toBeNull();

    const mockEvent = new CustomEvent('click');
    page.handleOpenOptions(mockEvent);
    expect(page.optionsEvent).toBe(mockEvent);

    const reportPromise = page.handleReport();
    await modalProps?.action('Me ha insultado');
    await reportPromise;

    expect(page.isOptionsOpen()).toBe(false);
    expect(chat['reportChat']).toHaveBeenCalledWith('t1', 'Me ha insultado');
    expect(showSuccess).toHaveBeenCalledWith('Chat denunciado. Lo revisaremos.');
  });

  it('reports nothing when the report is cancelled', async () => {
    await render();
    modalRole = 'cancel';

    await page.handleReport();

    expect(showSuccess).not.toHaveBeenCalled();
  });

  it('offers to retry when the conversation cannot be loaded', async () => {
    chat['listMessages'].mockRejectedValueOnce(new Error('offline'));
    const root = await render();
    expect(root.textContent).toContain('No hemos podido cargar la conversación');

    await page.handleRetry();
    fixture.detectChanges();

    expect(root.querySelectorAll('.bubble')).toHaveLength(2);
  });

  it('calls the only contact, or lets the driver choose among the passengers', async () => {
    chat['listContacts'].mockResolvedValue([
      { id: 'u2', name: 'Pía Ruiz', phone: '+34600333444', role: 'passenger' },
    ]);
    const root = await render();
    const openPhone = vi.spyOn(page, 'openPhone').mockImplementation(() => undefined);
    await vi.waitFor(() => expect(page.canCall()).toBe(true));
    fixture.detectChanges();

    const call = root.querySelector('.conversation__call');
    expect(call?.classList).not.toContain('conversation__call--unavailable');
    expect(page.callLabel()).toBe('Llamar a Pía Ruiz');
    await page.handleCall();
    expect(openPhone).toHaveBeenCalledWith('+34600333444');

    page.contacts.set([
      { id: 'u2', name: 'Pía Ruiz', phone: '+34600333444', role: 'passenger' },
      { id: 'u3', name: 'Leo Gil', phone: '+34600555666', role: 'passenger' },
    ]);
    expect(page.callLabel()).toBe('Llamar a un pasajero');
    await page.handleCall();
    expect(sheetButtons.map(({ text }) => text)).toEqual(['Pía Ruiz', 'Leo Gil', 'Cancelar']);
    sheetButtons[1].handler?.();
    expect(openPhone).toHaveBeenLastCalledWith('+34600555666');
  });

  it('greys out the call and explains why when nobody can be called', async () => {
    const root = await render({
      ...CONVERSATION,
      trip: { ...CONVERSATION.trip, status: 'cancelled' },
    });

    const call = root.querySelector('.conversation__call');
    expect(call?.classList).toContain('conversation__call--unavailable');
    expect(page.callLabel()).toBe('Llamar (no disponible)');
    await page.handleCall();
    expect(showInfo).toHaveBeenCalledWith(
      'Solo se puede llamar con el viaje confirmado o en curso.',
    );

    page.conversation.set(CONVERSATION);
    await page.handleCall();
    expect(showInfo).toHaveBeenLastCalledWith(
      'Nadie más de este viaje tiene el teléfono verificado.',
    );
  });

  it('puts the trip title in the heading band on the phone, and removes it when leaving', async () => {
    await render();
    const heading = TestBed.inject(HeadingContentService);
    expect(heading.content()).toBeNull();
    expect(fixture.nativeElement.querySelector('.conversation__heading')).not.toBeNull();

    fixture.componentRef.setInput('conversationId', 't1');
    fixture.componentRef.setInput('active', true);
    fixture.componentRef.setInput('inPageHeading', true);
    fixture.detectChanges();
    await vi.waitFor(() => expect(heading.content()).not.toBeNull());
    fixture.detectChanges();
    // Sin repetirlo dentro de la tarjeta
    expect(fixture.nativeElement.querySelector('.conversation__heading')).toBeNull();

    fixture.destroy();
    expect(heading.content()).toBeNull();
  });

  it('shows checkmark ✓ (Enviado) for own unread message and ✓✓ (Leído) when read by all', async () => {
    chat['listMessages'].mockResolvedValue([
      message('m1', 'me', { text: 'Primer mensaje', readByAll: false }),
      message('m2', 'me', { text: 'Segundo mensaje', readByAll: true }),
      message('m3', 'other', { text: 'Mensaje de otro' }),
    ]);

    const root = await render();

    const bubbles = root.querySelectorAll('.bubble');
    expect(bubbles).toHaveLength(3);

    // Primer mensaje propio: enviado (✓)
    const statusM1 = bubbles[0].querySelector('.bubble__status');
    expect(statusM1).not.toBeNull();
    expect(statusM1?.textContent?.trim()).toBe('✓');
    expect(statusM1?.getAttribute('aria-label')).toBe('Enviado');
    expect(statusM1?.classList).not.toContain('bubble__status--read');

    // Segundo mensaje propio: leído (✓✓)
    const statusM2 = bubbles[1].querySelector('.bubble__status');
    expect(statusM2).not.toBeNull();
    expect(statusM2?.textContent?.trim()).toBe('✓✓');
    expect(statusM2?.getAttribute('aria-label')).toBe('Leído');
    expect(statusM2?.classList).toContain('bubble__status--read');

    // Mensaje de otro participante: sin indicador de lectura propio
    const statusM3 = bubbles[2].querySelector('.bubble__status');
    expect(statusM3).toBeNull();
  });

  it('clears heading content when leaving view', async () => {
    await render();
    const heading = TestBed.inject(HeadingContentService);
    fixture.componentRef.setInput('conversationId', 't1');
    fixture.componentRef.setInput('active', true);
    fixture.componentRef.setInput('inPageHeading', true);
    fixture.detectChanges();
    await vi.waitFor(() => expect(heading.content()).not.toBeNull());

    page.ionViewDidLeave();
    expect(heading.content()).toBeNull();
  });
});
