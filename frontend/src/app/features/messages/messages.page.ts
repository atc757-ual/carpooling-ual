import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, chatbubblesOutline } from 'ionicons/icons';
import { Conversation } from '../../core/models/chat.model';
import { AuthService } from '../../core/services/auth/auth.service';
import { ChatService, CONVERSATIONS_PAGE_SIZE } from '../../core/services/chat/chat.service';
import { formatTime } from '../matching/trip-results';
import { formatElapsed } from '../notifications/notification-texts';
import { TRIP_STATUS_LABELS } from '../../shared/utils/trip-status.util';
import { messageText } from './chat-texts';
import { ConversationPage } from './conversation/conversation.page';
import { map } from 'rxjs';

// Mensajes: conversaciones recientes con filtro de no leídos y carga por lotes.
// Cada conversación abre el chat del viaje.
@Component({
  selector: 'app-messages',
  imports: [
    IonButton,
    IonCard,
    IonCardContent,
    IonChip,
    IonContent,
    IonIcon,
    IonSpinner,
    ConversationPage,
  ],
  templateUrl: './messages.page.html',
  styleUrls: ['../tabs/tab-page.scss', './messages.page.scss'],
})
export class MessagesPage implements OnInit {
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly routeConversationId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('tripId'))),
    { initialValue: null },
  );
  private hasEntered = false;
  private requestVersion = 0;
  private readonly desktopQuery =
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(min-width: 768px)')
      : null;

  readonly onlyUnread = signal(false);
  readonly all = signal<Conversation[]>([]);
  readonly total = signal(0);
  readonly offset = signal(0);
  readonly isLoading = signal(true);
  readonly isLoadingMore = signal(false);
  readonly error = signal(false);
  readonly loadMoreError = signal(false);
  readonly selectedConversationId = signal<string | null>(null);
  readonly pageActive = signal(true);
  readonly activeConversationId = computed(
    () => this.selectedConversationId() ?? this.routeConversationId(),
  );
  readonly isDesktop = signal(this.desktopQuery?.matches ?? false);
  readonly mobileDetail = computed(() => !this.isDesktop() && !!this.routeConversationId());
  readonly unreadCount = this.chat.unreadConversationCount;
  readonly hasMore = computed(() => this.offset() < this.total());

  protected readonly pageSize = CONVERSATIONS_PAGE_SIZE;
  protected readonly icon = chatbubblesOutline;
  protected readonly errorIcon = alertCircleOutline;

  ngOnInit(): void {
    if (this.desktopQuery) {
      const updateViewport = (event: MediaQueryListEvent): void =>
        this.isDesktop.set(event.matches);
      this.desktopQuery.addEventListener('change', updateViewport);
      this.destroyRef.onDestroy(() =>
        this.desktopQuery?.removeEventListener('change', updateViewport),
      );
    }
    void this.loadPage(false);
  }

  // Ionic conserva esta página entre pestañas: refresca al volver, no al primer
  // render, para no duplicar la petición inicial.
  ionViewWillEnter(): void {
    this.pageActive.set(true);
    if (this.hasEntered) void this.loadPage(false);
    this.hasEntered = true;
  }

  ionViewDidLeave(): void {
    this.pageActive.set(false);
  }

  async handleFilter(onlyUnread: boolean): Promise<void> {
    if (this.onlyUnread() === onlyUnread) return;
    this.onlyUnread.set(onlyUnread);
    this.all.set([]);
    this.total.set(0);
    this.offset.set(0);
    await this.loadPage(false);
  }

  async handleLoadMore(): Promise<void> {
    if (this.isLoading() || this.isLoadingMore() || !this.hasMore()) return;
    await this.loadPage(true);
  }

  async handleRetry(): Promise<void> {
    await this.loadPage(this.loadMoreError());
  }

  async handleSelectConversation(event: MouseEvent, conversationId: string): Promise<void> {
    if (this.isDesktop()) {
      event.preventDefault();
      this.selectedConversationId.set(conversationId);
      return;
    }
    this.selectedConversationId.set(null);
    await this.router.navigate(['/tabs/messages', conversationId]);
  }

  protected statusLabel(conversation: Conversation): string {
    return TRIP_STATUS_LABELS[conversation.trip.status];
  }

  // La hora de salida del viaje: «07:30»
  protected departureTime(conversation: Conversation): string {
    return formatTime(conversation.trip.departureAt);
  }

  // «Pía R.: Estoy en el portal», «Tú: Perfecto» o, sin mensajes, cómo empezar
  protected preview(conversation: Conversation): string {
    const message = conversation.lastMessage;
    if (!message) {
      return 'Escribe el primer mensaje';
    }
    const author = message.author.id === this.auth.currentUser()?.id ? 'Tú' : message.author.name;
    return `${author}: ${messageText(message)}`;
  }

  protected elapsed(conversation: Conversation): string {
    return conversation.lastMessage
      ? formatElapsed(conversation.lastMessage.createdAt, new Date())
      : '';
  }

  private async loadPage(append: boolean): Promise<void> {
    const version = ++this.requestVersion;
    const offset = append ? this.offset() : 0;
    if (append) {
      this.isLoadingMore.set(true);
      this.loadMoreError.set(false);
    } else {
      this.isLoading.set(true);
      this.error.set(false);
    }

    try {
      const page = await this.chat.listConversationsPage({
        offset,
        limit: this.pageSize,
        hasUnread: this.onlyUnread() || undefined,
      });
      if (version !== this.requestVersion) return;
      this.all.update((items) => (append ? [...items, ...page.items] : page.items));
      this.total.set(page.total);
      this.offset.set(offset + page.items.length);
    } catch {
      if (version !== this.requestVersion) return;
      if (append) this.loadMoreError.set(true);
      else this.error.set(true);
    } finally {
      if (version === this.requestVersion) {
        this.isLoading.set(false);
        this.isLoadingMore.set(false);
      }
    }
  }
}
