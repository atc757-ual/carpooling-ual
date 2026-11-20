import { translate, TranslocoPipe } from '@jsverse/transloco';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonChip,
  IonContent,
  IonItem,
  IonList,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, chatbubblesOutline } from 'ionicons/icons';
import { Conversation } from '../../core/models/chat.model';
import { EmptyState } from '../../shared/components/ui/empty-state/empty-state';
import { LoadingState } from '../../shared/components/ui/loading-state/loading-state';
import { AuthService } from '../../core/services/auth/auth.service';
import {
  ChatService,
  conversationIdOf,
  CONVERSATIONS_PAGE_SIZE,
  isSameConversation,
  parseConversationId,
} from '../../core/services/chat/chat.service';
import { formatTime } from '../matching/trip-results';
import { formatElapsed } from '../notifications/notification-texts';
import { tripStatusLabel } from '../../shared/utils/trip-status.util';
import { messageText } from './chat-texts';
import { ConversationPage } from './conversation/conversation.page';
import { map } from 'rxjs';
import { SectionHeading } from '../../shared/components/layout/section-heading/section-heading';
import { rethrowUnlessApiError } from '../../core/models/api-error.model';

// Mensajes: conversaciones recientes con filtro de no leídos y carga por lotes.
// El chat es directo: el conductor tiene una conversación con cada pasajero y
// el pasajero, la suya con el conductor. Cada una abre su chat.
@Component({
  selector: 'app-messages',
  imports: [
    SectionHeading,
    EmptyState,
    LoadingState,
    IonButton,
    IonCard,
    IonCardContent,
    IonChip,
    IonContent,
    IonItem,
    IonList,
    IonSpinner,
    ConversationPage,
    TranslocoPipe,
  ],
  templateUrl: './messages.page.html',
  styleUrls: ['../tabs/tab-page.scss', './messages.page.scss'],
})
export class MessagesPage implements OnInit {
  private readonly chat = inject(ChatService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  // «viaje:pasajero» o, la del pasajero con el conductor, solo el viaje
  private readonly routeConversationId = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => {
        const tripId = params.get('tripId');
        return tripId ? conversationIdOf({ tripId, passengerId: params.get('passengerId') }) : null;
      }),
    ),
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
  // La elegida en la lista en escritorio, sin cambiar la URL. Si después la
  // URL abre otra conversación (p. ej. desde un aviso), se vacía y manda la URL
  readonly selectedConversationId = linkedSignal<string | null, string | null>({
    source: this.routeConversationId,
    computation: () => null,
  });
  readonly pageActive = signal(true);
  readonly activeConversationId = computed(
    () => this.selectedConversationId() ?? this.routeConversationId(),
  );
  readonly isDesktop = signal(this.desktopQuery?.matches ?? false);
  readonly mobileDetail = computed(() => !this.isDesktop() && !!this.routeConversationId());
  readonly unreadCount = this.chat.unreadConversationCount;
  readonly hasMore = computed(() => this.offset() < this.total());

  // Al leer una conversación (en escritorio, abierta al lado), su contador
  // pasa a cero en la lista sin recargarla
  private readonly clearReadConversation = effect(() => {
    const read = this.chat.lastRead();
    if (!read) return;
    this.all.update((conversations) =>
      conversations.map((conversation) =>
        isSameConversation(conversation, read) && conversation.unreadCount > 0
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    );
  });

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

  // Al dejar de estar activa, su conversación quita su propia cabecera (y las
  // pestañas limpian la franja al salir de Mensajes). Sin un clear() general:
  // esta página sale después de que entre la siguiente (p. ej. el chat al
  // abrirlo desde la lista) y borraría la cabecera que esa ya ha puesto
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

  async handleSelectConversation(event: MouseEvent, conversation: Conversation): Promise<void> {
    if (this.isDesktop()) {
      event.preventDefault();
      this.selectedConversationId.set(conversation.id);
      return;
    }
    this.selectedConversationId.set(null);
    await this.router.navigate(['/tabs/messages', conversation.trip.id, conversation.passenger.id]);
  }

  // La conversación abierta (también la del pasajero, que llega sin pasajero)
  protected isSelected(conversation: Conversation): boolean {
    const activeId = this.activeConversationId();
    return activeId !== null && isSameConversation(conversation, parseConversationId(activeId));
  }

  // «07:30 · Campus UAL» o, al conductor, con quién: «Pía · 07:30 · Campus UAL»
  protected title(conversation: Conversation): string {
    const trip = `${this.departureTime(conversation)} · ${conversation.trip.destinationName ?? 'Destino'}`;
    return conversation.myRole === 'driver' ? `${conversation.passenger.name} · ${trip}` : trip;
  }

  protected statusLabel(conversation: Conversation): string {
    return tripStatusLabel(conversation.trip.status);
  }

  // La hora de salida del viaje: «07:30»
  protected departureTime(conversation: Conversation): string {
    return formatTime(conversation.trip.departureAt);
  }

  // «Pía R.: Estoy en el portal», «Tú: Perfecto» o, sin mensajes, cómo empezar
  protected preview(conversation: Conversation): string {
    const message = conversation.lastMessage;
    if (!message) {
      return translate('screens.messages.escribePrimerMensaje');
    }
    const author =
      message.author.id === this.auth.currentUser()?.id
        ? translate('screens.messages.you')
        : message.author.name;
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
    } catch (error) {
      rethrowUnlessApiError(error);
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
