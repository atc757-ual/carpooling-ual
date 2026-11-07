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

const DAY_FORMAT = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short' });
const DAY_WITH_YEAR_FORMAT = new Intl.DateTimeFormat('es-ES', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

// El separador de cada día de la conversación, como en las apps de
// mensajería: «Hoy», «Ayer», «3 nov» o, de otro año, «3 nov 2025»
export function messageDay(isoDate: string, now = new Date()): string {
  const date = new Date(isoDate);
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (daysAgo === 0) return 'Hoy';
  if (daysAgo === 1) return 'Ayer';
  return (date.getFullYear() === now.getFullYear() ? DAY_FORMAT : DAY_WITH_YEAR_FORMAT).format(
    date,
  );
}

export interface MessageDayGroup {
  day: string;
  messages: ChatMessage[];
}

// Los mensajes (ya en orden) agrupados por día, cada grupo con su separador
export function groupMessagesByDay(messages: ChatMessage[], now = new Date()): MessageDayGroup[] {
  const groups: MessageDayGroup[] = [];
  for (const message of messages) {
    const day = messageDay(message.createdAt, now);
    const last = groups.at(-1);
    if (last?.day === day) {
      last.messages.push(message);
    } else {
      groups.push({ day, messages: [message] });
    }
  }
  return groups;
}

// Medianoche en hora local (en milisegundos)
function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
