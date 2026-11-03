import { Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonContent,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import { alertCircleOutline, chatbubblesOutline } from 'ionicons/icons';
import { Conversation } from '../../core/models/chat.model';
import { ChatService } from '../../core/services/chat/chat.service';
import { formatDateLabel } from '../../shared/components/ui/datetime-field/datetime-field';
import { formatTime } from '../matching/trip-results';
import { formatElapsed } from '../notifications/notification-texts';
import { messageText } from './chat-texts';

// Mensajes: los chats de los viajes donde conduces o tienes plaza aceptada,
// el que se movió último primero, con su último mensaje y los no leídos.
// Cada uno abre su conversación
@Component({
  selector: 'app-messages',
  imports: [IonButton, IonCard, IonCardContent, IonContent, IonIcon, IonSpinner, RouterLink],
  templateUrl: './messages.page.html',
  styleUrls: ['../tabs/tab-page.scss', './messages.page.scss'],
})
export class MessagesPage {
  private readonly chat = inject(ChatService);

  readonly conversations = resource({
    loader: () => this.chat.listConversations(),
  });
  readonly all = computed(() => (this.conversations.hasValue() ? this.conversations.value() : []));

  protected readonly icon = chatbubblesOutline;
  protected readonly errorIcon = alertCircleOutline;

  // Cada vez que se entra: puede haber mensajes nuevos
  ionViewWillEnter(): void {
    this.conversations.reload();
  }

  handleRetry(): void {
    this.conversations.reload();
  }

  // «Roquetas de Mar → Campus UAL»
  protected route(conversation: Conversation): string {
    const { originName, destinationName } = conversation.trip;
    return `${originName ?? 'Origen'} → ${destinationName ?? 'Destino'}`;
  }

  // «Mañana · 07:40»
  protected when(conversation: Conversation): string {
    const { departureAt } = conversation.trip;
    const day = formatDateLabel(new Date(departureAt).toLocaleDateString('sv-SE'));
    return `${day} · ${formatTime(departureAt)}`;
  }

  // «Pía R.: Estoy en el portal» o, sin mensajes, cómo empezar
  protected preview(conversation: Conversation): string {
    const message = conversation.lastMessage;
    return message
      ? `${message.author.name}: ${messageText(message)}`
      : 'Escribe el primer mensaje';
  }

  protected elapsed(conversation: Conversation): string {
    return conversation.lastMessage
      ? formatElapsed(conversation.lastMessage.createdAt, new Date())
      : '';
  }
}
