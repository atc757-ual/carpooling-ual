import {
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  ActionSheetController,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonPopover,
  IonSkeletonText,
  IonSpinner,
  IonTextarea,
  ModalController,
} from '@ionic/angular';
import {
  alertCircleOutline,
  arrowForwardOutline,
  callOutline,
  ellipseOutline,
  ellipsisVertical,
  flagOutline,
  locationOutline,
  lockClosedOutline,
  send,
} from 'ionicons/icons';
import { map } from 'rxjs';
import { ApiError } from '../../../core/models/api-error.model';
import {
  ChatContact,
  ChatMessage,
  ChatMessageInput,
  Conversation,
  QuickReply,
} from '../../../core/models/chat.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ChatService } from '../../../core/services/chat/chat.service';
import { TripCallService } from '../../../core/services/trips/trip-call.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { HeadingContentService } from '../../../core/services/ui/heading-content.service';
import { confirmWithReason } from '../../../shared/components/modals/reason-confirm-modal/reason-confirm-modal';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { TRIP_STATUS_LABELS } from '../../../shared/utils/trip-status.util';
import { formatTime } from '../../matching/trip-results';
import {
  groupMessagesByDay,
  messageText,
  messageTime,
  quickRepliesForMoment,
  QUICK_REPLY_TEXTS,
} from '../chat-texts';
import { ConversationAvatar } from '../conversation-avatar/conversation-avatar';

// Cada cuánto se piden los mensajes nuevos con la conversación a la vista
export const CHAT_POLL_INTERVAL_MS = 5_000;
export const MAX_MESSAGE_LENGTH = 500;

// La conversación del chat de un viaje: los mensajes (los míos a la derecha),
// las respuestas rápidas y la caja de texto. Con la conversación a la vista,
// pide los nuevos cada 5 s y la marca como leída. Con el viaje en curso, el
// conductor solo ve las respuestas rápidas (seguridad vial); cerrada, solo se
// lee
@Component({
  selector: 'app-conversation',
  imports: [
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonPopover,
    IonSkeletonText,
    IonSpinner,
    IonTextarea,
    NgTemplateOutlet,
    ConversationAvatar,
  ],
  templateUrl: './conversation.page.html',
  styleUrl: './conversation.page.scss',
})
export class ConversationPage {
  private readonly chat = inject(ChatService);
  private readonly tripCall = inject(TripCallService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;

  private readonly routeTripId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('tripId') ?? '')),
    { initialValue: '' },
  );
  readonly conversationId = input<string | null>(null);
  readonly active = input(false);
  // En el móvil, el título del viaje va en la franja del título y no en la tarjeta
  readonly inPageHeading = input(false);
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isActive = false;
  private pollInFlight = false;
  private readonly scrollContainer = viewChild<ElementRef<HTMLDivElement>>('scrollContainer');
  private readonly headingTitle = viewChild.required<TemplateRef<unknown>>('headingTitle');
  private readonly headingContent = inject(HeadingContentService);
  private readonly handleVisibilityChange = (): void => {
    if (!this.isActive) return;
    if (document.hidden) {
      this.stopPolling();
      return;
    }
    if (this.conversation() && !this.hasError()) {
      this.stopPolling();
      void this.fetchNew().finally(() => this.schedulePolling());
    }
  };

  readonly conversation = signal<Conversation | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  // A quién puedo llamar (vacío: sin botón de llamar)
  readonly contacts = signal<ChatContact[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly isSending = signal(false);
  readonly draft = signal('');
  readonly isOptionsOpen = signal(false);
  optionsEvent: Event | null = null;
  private currentTripId = '';
  private loadVersion = 0;

  // El conductor con el viaje en marcha: se le recuerda que mejor respuestas
  // rápidas (puede escribir: estará parado)
  readonly isDriverOnTrip = computed(() => {
    const conversation = this.conversation();
    return conversation?.myRole === 'driver' && conversation.trip.status === 'in_progress';
  });
  // Con un separador por día («Hoy», «Ayer», «3 nov»)
  readonly messageGroups = computed(() => groupMessagesByDay(this.messages()));
  readonly canWrite = computed(() => this.conversation()?.isOpen ?? false);
  readonly canSendText = computed(() => {
    const length = this.draft().trim().length;
    return length > 0 && length <= MAX_MESSAGE_LENGTH && !this.isSending();
  });

  protected readonly quickReplies = computed(() => {
    const conversation = this.conversation();
    return conversation ? quickRepliesForMoment(conversation.trip, conversation.myRole) : [];
  });
  protected readonly quickReplyText = QUICK_REPLY_TEXTS;
  protected readonly maxLength = MAX_MESSAGE_LENGTH;
  protected readonly sendIcon = send;
  protected readonly reportIcon = flagOutline;
  protected readonly optionsIcon = ellipsisVertical;
  protected readonly optionsLabel = 'Más opciones';
  protected readonly callIcon = callOutline;
  protected readonly originIcon = ellipseOutline;
  protected readonly destinationIcon = locationOutline;
  protected readonly arrowIcon = arrowForwardOutline;
  protected readonly closedIcon = lockClosedOutline;
  protected readonly errorIcon = alertCircleOutline;
  protected readonly text = messageText;
  protected readonly time = messageTime;

  constructor() {
    const destroyRef = inject(DestroyRef);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    effect(() => {
      const tripId = this.conversationId();
      const isActive = this.active();
      if (!tripId) return;
      this.isActive = isActive;
      this.stopPolling();
      if (!isActive) return;
      void this.load(tripId).finally(() => this.schedulePolling());
    });
    // El título en la franja del título: con el chat a la vista en el móvil,
    // desde que se entra (con un esqueleto mientras carga). Si falla la carga,
    // vuelve el título de la ruta
    effect(() => {
      const template = this.headingTitle();
      if (this.inPageHeading() && this.active() && !this.hasError()) {
        this.headingContent.show(template);
      } else {
        this.headingContent.clear(template);
      }
    });
    destroyRef.onDestroy(() => {
      this.headingContent.clear(this.headingTitle());
      this.isActive = false;
      this.stopPolling();
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    });
  }

  // Al entrar: carga el chat; solo inicia el polling si quedó disponible
  async ionViewWillEnter(): Promise<void> {
    this.isActive = true;
    this.stopPolling();
    await this.load(this.tripId());
    this.schedulePolling();
  }

  ionViewDidLeave(): void {
    this.isActive = false;
    this.stopPolling();
    this.headingContent.clear(this.headingTitle());
  }

  isMine(message: ChatMessage): boolean {
    return message.author.id === this.auth.currentUser()?.id;
  }

  statusAriaLabel(message: ChatMessage): string {
    if (message.readByAll) {
      return this.transloco ? this.transloco.translate('common.chatReceipt.read') : 'Leído';
    }
    return this.transloco ? this.transloco.translate('common.chatReceipt.sent') : 'Enviado';
  }

  originName(): string {
    return this.conversation()?.trip.originName ?? 'Origen';
  }

  destinationName(): string {
    return this.conversation()?.trip.destinationName ?? 'Destino';
  }

  departureTime(): string {
    const departureAt = this.conversation()?.trip.departureAt;
    return departureAt ? formatTime(departureAt) : '';
  }

  driverName(): string {
    return this.conversation()?.trip.driverName ?? '';
  }

  driverAvatarKey(): string | null {
    return this.conversation()?.trip.driverAvatarKey ?? null;
  }

  // «Llamar a Lucía» o, al conductor con varios pasajeros, «Llamar»
  // El estado del viaje, como etiqueta junto al título
  statusLabel(): string {
    const status = this.conversation()?.trip.status;
    return status ? TRIP_STATUS_LABELS[status] : '';
  }

  // Hay a quién llamar: viaje confirmado o en curso y teléfono verificado
  canCall(): boolean {
    return this.contacts().length > 0;
  }

  callLabel(): string {
    const contacts = this.contacts();
    if (contacts.length === 0) return 'Llamar (no disponible)';
    return contacts.length === 1 ? `Llamar a ${contacts[0].name}` : 'Llamar a un pasajero';
  }

  // Con una persona, abre su teléfono; con varias (el conductor), se elige.
  // Sin nadie, el botón está deshabilitado
  async handleCall(): Promise<void> {
    const contacts = this.contacts();
    if (contacts.length === 0) return;
    if (contacts.length === 1) {
      this.openPhone(contacts[0].phone);
      return;
    }
    const sheet = await this.actionSheetController.create({
      header: '¿A quién llamas?',
      buttons: [
        ...contacts.map((contact) => ({
          text: contact.name,
          handler: () => this.openPhone(contact.phone),
        })),
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  // Menú de opciones del chat: tres puntos al lado del teléfono
  handleOpenOptions(event?: Event): void {
    if (event) {
      this.optionsEvent = event;
    }
    this.isOptionsOpen.set(true);
  }

  handleDraft(value: string | null | undefined): void {
    this.draft.set(value ?? '');
  }

  // Enter envía; Mayús+Enter hace un salto de línea (y no se envía mientras
  // se compone una palabra con el teclado, p. ej. con acentos)
  handleEnter(event: Event): void {
    const key = event as KeyboardEvent;
    if (key.shiftKey || key.isComposing) {
      return;
    }
    event.preventDefault();
    void this.handleSendText();
  }

  async handleSendText(): Promise<void> {
    if (!this.canSendText()) {
      return;
    }
    if (await this.sendMessage({ text: this.draft().trim() })) {
      this.draft.set('');
    }
  }

  async handleQuickReply(quickReply: QuickReply): Promise<void> {
    await this.sendMessage({ quickReply });
  }

  // Denunciar el chat con su motivo: lo revisa el administrador con una copia
  // de la conversación. Se puede volver a denunciar (llegan mensajes nuevos)
  async handleReport(): Promise<void> {
    this.isOptionsOpen.set(false);
    const reported = await confirmWithReason(this.modalController, {
      header: '¿Denunciar este chat?',
      message:
        'Lo revisará el equipo de Carpooling UAL con una copia de la conversación. Nadie del viaje sabrá que lo has denunciado.',
      confirmText: 'Denunciar',
      action: (reason) => this.chat.reportChat(this.tripId(), reason),
    });
    if (reported) {
      void this.toast.showSuccess('Chat denunciado. Lo revisaremos.');
    }
  }

  async handleRetry(): Promise<void> {
    this.stopPolling();
    await this.load(this.tripId());
    this.schedulePolling();
  }

  private tripId(): string {
    return this.conversationId() ?? this.routeTripId();
  }

  private async load(tripId: string): Promise<void> {
    if (!tripId) return;
    const version = ++this.loadVersion;
    if (tripId !== this.currentTripId) {
      this.currentTripId = tripId;
      this.conversation.set(null);
      this.messages.set([]);
      this.contacts.set([]);
    }
    this.isLoading.set(true);
    this.hasError.set(false);
    try {
      const [conversation, messages] = await Promise.all([
        this.chat.getConversation(tripId).catch(async () => {
          const conversations = await this.chat.listConversations();
          return conversations.find(({ id }) => id === tripId) ?? null;
        }),
        this.chat.listMessages(tripId),
      ]);
      if (version !== this.loadVersion) return;
      this.conversation.set(conversation);
      this.messages.set(messages);
      void this.loadContacts(tripId, version);
      this.scrollToBottom();
      await this.markRead(tripId);
    } catch {
      if (version === this.loadVersion) this.hasError.set(true);
    } finally {
      if (version === this.loadVersion) this.isLoading.set(false);
    }
  }

  // Los posteriores al último que ya se tiene. Si falla (sin señal), se
  // intenta en la siguiente vuelta
  private async fetchNew(): Promise<void> {
    if (!this.isActive || document.hidden || this.pollInFlight) return;
    this.pollInFlight = true;
    const last = this.messages().at(-1);
    try {
      const tripId = this.tripId();
      const newer = await this.chat.listMessages(tripId, last?.id);
      if (newer.length > 0) {
        this.appendMessages(newer);
        await this.markRead(tripId);
      }
      await this.refreshReceipts(tripId);
    } catch {
      // Siguiente vuelta
    } finally {
      this.pollInFlight = false;
    }
  }

  private async sendMessage(input: ChatMessageInput): Promise<boolean> {
    this.isSending.set(true);
    try {
      const sent = await this.chat.send(this.tripId(), input);
      this.appendMessages([sent]);
      return true;
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
      return false;
    } finally {
      this.isSending.set(false);
    }
  }

  // Sin repetir los que ya están (el envío y la consulta pueden cruzarse)
  // El ✓✓ de mis mensajes: si alguno aún no lo han leído todos, se vuelve a
  // mirar en cada vuelta (sin esto solo se veía al volver a entrar al chat)
  private async refreshReceipts(tripId: string): Promise<void> {
    if (!this.messages().some((message) => this.isMine(message) && !message.readByAll)) {
      return;
    }
    const current = await this.chat.listMessages(tripId);
    const read = new Set(current.filter(({ readByAll }) => readByAll).map(({ id }) => id));
    this.messages.update((messages) =>
      messages.map((message) =>
        !message.readByAll && read.has(message.id) ? { ...message, readByAll: true } : message,
      ),
    );
  }

  private appendMessages(newer: ChatMessage[]): void {
    this.messages.update((messages) => {
      const ids = new Set(messages.map(({ id }) => id));
      return [...messages, ...newer.filter(({ id }) => !ids.has(id))];
    });
    this.scrollToBottom();
  }

  // Al último mensaje, cuando ya está pintado
  private scrollToBottom(): void {
    setTimeout(() => {
      const element = this.scrollContainer()?.nativeElement;
      if (element) element.scrollTop = element.scrollHeight;
    });
  }

  // Abre la app de teléfono del dispositivo con el número
  openPhone(phone: string): void {
    this.tripCall.openPhone(phone);
  }

  // Sin contactos (o si falla), el botón de llamar queda deshabilitado
  private async loadContacts(tripId: string, version: number): Promise<void> {
    const contacts = await this.tripCall.loadContacts(tripId);
    if (version === this.loadVersion) this.contacts.set(contacts);
  }

  private async markRead(tripId: string): Promise<void> {
    await this.chat.markRead(tripId).catch(() => undefined);
  }

  private stopPolling(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private schedulePolling(): void {
    this.stopPolling();
    if (!this.isActive || document.hidden || this.hasError() || this.conversation() === null) {
      return;
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.fetchNew().finally(() => this.schedulePolling());
    }, CHAT_POLL_INTERVAL_MS);
  }
}
