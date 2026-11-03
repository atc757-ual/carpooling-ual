import { ChatMessage, QuickReply } from '../../core/models/chat.model';

// El texto de cada respuesta rápida (la API guarda solo la clave)
export const QUICK_REPLY_TEXTS: Record<QuickReply, string> = {
  at_pickup: 'Ya estoy en el punto',
  running_late: 'Llego 5 min tarde',
  on_my_way: 'Estoy en camino',
  where_are_you: '¿Dónde estás?',
};

export const QUICK_REPLIES = Object.keys(QUICK_REPLY_TEXTS) as QuickReply[];

// Lo que se lee de un mensaje: su texto o el de su respuesta rápida
export function messageText(message: Pick<ChatMessage, 'text' | 'quickReply'>): string {
  if (message.quickReply) {
    return QUICK_REPLY_TEXTS[message.quickReply];
  }
  return message.text ?? '';
}

const TIME_FORMAT = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' });

// «07:40»
export function messageTime(isoDate: string): string {
  return TIME_FORMAT.format(new Date(isoDate));
}
