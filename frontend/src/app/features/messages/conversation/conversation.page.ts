import { Component, computed, DestroyRef, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonFooter,
  IonIcon,
  IonSpinner,
  IonTextarea,
  ModalController,
} from '@ionic/angular';
import { alertCircleOutline, flagOutline, lockClosedOutline, send } from 'ionicons/icons';
import { map } from 'rxjs';
import { ApiError } from '../../../core/models/api-error.model';
import {
  ChatMessage,
  ChatMessageInput,
  Conversation,
  QuickReply,
} from '../../../core/models/chat.model';
import { AuthService } from '../../../core/services/auth/auth.service';
import { ChatService } from '../../../core/services/chat/chat.service';
import { ToastService } from '../../../core/services/ui/toast.service';
import { confirmWithReason } from '../../../shared/components/modals/reason-confirm-modal/reason-confirm-modal';
import { getErrorMessage } from '../../../shared/utils/error-message.util';
import { messageText, messageTime, QUICK_REPLIES, QUICK_REPLY_TEXTS } from '../chat-texts';

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
  imports: [IonButton, IonContent, IonFooter, IonIcon, IonSpinner, IonTextarea],
  templateUrl: './conversation.page.html',
  styleUrls: ['../../tabs/tab-page.scss', './conversation.page.scss'],
})
export class ConversationPage {
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly modalController = inject(ModalController);

  private readonly tripId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('tripId') ?? '')),
    { initialValue: '' },
  );
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly content = viewChild(IonContent);

  readonly conversation = signal<Conversation | null>(null);
  readonly messages = signal<ChatMessage[]>([]);
  readonly isLoading = signal(true);
  readonly hasError = signal(false);
  readonly isSending = signal(false);
  readonly draft = signal('');
  // Los que ya he denunciado en esta visita (no se ofrece otra vez)
  readonly reportedIds = signal<ReadonlySet<string>>(new Set());

  readonly isQuickRepliesOnly = computed(() => {
    const conversation = this.conversation();
    return conversation?.myRole === 'driver' && conversation.trip.status === 'in_progress';
  });
  readonly canWrite = computed(() => this.conversation()?.isOpen ?? false);
  readonly canSendText = computed(() => {
    const length = this.draft().trim().length;
    return length > 0 && length <= MAX_MESSAGE_LENGTH && !this.isSending();
  });

  protected readonly quickReplies = QUICK_REPLIES;
  protected readonly quickReplyText = QUICK_REPLY_TEXTS;
  protected readonly maxLength = MAX_MESSAGE_LENGTH;
  protected readonly sendIcon = send;
  protected readonly reportIcon = flagOutline;
  protected readonly closedIcon = lockClosedOutline;
  protected readonly errorIcon = alertCircleOutline;
  protected readonly text = messageText;
  protected readonly time = messageTime;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stopPolling());
  }

  // Al entrar: la conversación, sus mensajes y, cada 5 s, los nuevos
  async ionViewWillEnter(): Promise<void> {
    await this.load();
    this.stopPolling();
    this.timer = setInterval(() => void this.fetchNew(), CHAT_POLL_INTERVAL_MS);
  }

  ionViewDidLeave(): void {
    this.stopPolling();
  }

  isMine(message: ChatMessage): boolean {
    return message.author.id === this.auth.currentUser()?.id;
  }

  // «Roquetas de Mar → Campus UAL»
  route(): string {
    const trip = this.conversation()?.trip;
    return trip ? `${trip.originName ?? 'Origen'} → ${trip.destinationName ?? 'Destino'}` : '';
  }

  handleDraft(value: string | null | undefined): void {
    this.draft.set(value ?? '');
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

  // Denunciar el mensaje de otro con su motivo: lo revisa el administrador
  async handleReport(message: ChatMessage): Promise<void> {
    const reported = await confirmWithReason(this.modalController, {
      header: '¿Denunciar este mensaje?',
      message: `Lo revisará el equipo de Carpooling UAL. ${message.author.name} no sabrá que lo has denunciado.`,
      confirmText: 'Denunciar',
      action: (reason) => this.chat.reportMessage(this.tripId(), message.id, reason),
    });
    if (reported) {
      this.reportedIds.update((ids) => new Set([...ids, message.id]));
      void this.toast.showSuccess('Mensaje denunciado. Lo revisaremos.');
    }
  }

  async handleRetry(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<void> {
    const tripId = this.tripId();
    this.isLoading.set(true);
    this.hasError.set(false);
    try {
      const [conversations, messages] = await Promise.all([
        this.chat.listConversations(),
        this.chat.listMessages(tripId),
      ]);
      this.conversation.set(conversations.find(({ id }) => id === tripId) ?? null);
      this.messages.set(messages);
      this.scrollToBottom();
      await this.markRead();
    } catch {
      this.hasError.set(true);
    } finally {
      this.isLoading.set(false);
    }
  }

  // Los posteriores al último que ya se tiene. Si falla (sin señal), se
  // intenta en la siguiente vuelta
  private async fetchNew(): Promise<void> {
    const last = this.messages().at(-1);
    try {
      const newer = await this.chat.listMessages(this.tripId(), last?.id);
      if (newer.length > 0) {
        this.appendMessages(newer);
        await this.markRead();
      }
    } catch {
      // Siguiente vuelta
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
  private appendMessages(newer: ChatMessage[]): void {
    this.messages.update((messages) => {
      const ids = new Set(messages.map(({ id }) => id));
      return [...messages, ...newer.filter(({ id }) => !ids.has(id))];
    });
    this.scrollToBottom();
  }

  // Al último mensaje, cuando ya está pintado
  private scrollToBottom(): void {
    setTimeout(() => void this.content()?.scrollToBottom(200));
  }

  private async markRead(): Promise<void> {
    await this.chat.markRead(this.tripId()).catch(() => undefined);
  }

  private stopPolling(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
