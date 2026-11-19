import { translate } from '@jsverse/transloco';
import { ChatMessage, ChatRole, QuickReply } from '../../core/models/chat.model';
import { dateTimeFormat } from '../../core/i18n/app-locale';

// El texto de cada respuesta rápida (la API guarda solo la clave)
export const QUICK_REPLIES: readonly QuickReply[] = [
  'at_pickup',
  'running_late',
  'on_my_way',
  'where_are_you',
  'leaving_soon',
  'still_going',
  'arriving_soon',
  'stopping_here',
  'on_time',
  'still_coming',
  'im_coming',
  'pickup_where',
  'waiting_for_you',
  'heading_down',
  'i_see_you',
  'can_we_stop',
];

export function quickReplyText(reply: QuickReply): string {
  return translate(`labels.quickReplies.${reply}`);
}

// Desde cuánto antes de la salida se considera que va a recoger
const PICKUP_WINDOW_MS = 15 * 60 * 1000;

type TripMoment = 'before' | 'pickup' | 'inProgress';

const DRIVER_PICKUP: readonly QuickReply[] = [
  'on_my_way',
  'running_late',
  'at_pickup',
  'waiting_for_you',
  'where_are_you',
];
const PASSENGER_PICKUP: readonly QuickReply[] = [
  'heading_down',
  'at_pickup',
  'running_late',
  'i_see_you',
  'where_are_you',
];

// En curso se sigue recogiendo gente (el chat no sabe quién ha subido ya):
// se mantienen las de la recogida
const QUICK_REPLIES_BY_ROLE: Readonly<
  Record<ChatRole, Readonly<Record<TripMoment, readonly QuickReply[]>>>
> = {
  driver: {
    before: ['leaving_soon', 'on_time', 'still_coming', 'running_late'],
    pickup: DRIVER_PICKUP,
    inProgress: [...DRIVER_PICKUP, 'arriving_soon', 'stopping_here'],
  },
  passenger: {
    before: ['still_going', 'im_coming', 'pickup_where', 'running_late'],
    pickup: PASSENGER_PICKUP,
    inProgress: [...PASSENGER_PICKUP, 'can_we_stop'],
  },
};

function tripMoment(trip: { status: string; departureAt: string }, now: number): TripMoment {
  if (trip.status === 'in_progress') {
    return 'inProgress';
  }
  return Date.parse(trip.departureAt) - now > PICKUP_WINDOW_MS ? 'before' : 'pickup';
}

// Las respuestas que tienen sentido para quien escribe en este momento del viaje
export function quickRepliesForMoment(
  trip: { status: string; departureAt: string },
  role: ChatRole,
  now = Date.now(),
): readonly QuickReply[] {
  return QUICK_REPLIES_BY_ROLE[role][tripMoment(trip, now)];
}

// Lo que se lee de un mensaje: su texto o el de su respuesta rápida
export function messageText(message: Pick<ChatMessage, 'text' | 'quickReply'>): string {
  if (message.quickReply) {
    return quickReplyText(message.quickReply);
  }
  return message.text ?? '';
}

const TIME_FORMAT = () => dateTimeFormat({ hour: '2-digit', minute: '2-digit' });

// «07:40»
export function messageTime(isoDate: string): string {
  return TIME_FORMAT().format(new Date(isoDate));
}

const DAY_FORMAT = () => dateTimeFormat({ day: 'numeric', month: 'short' });
const DAY_WITH_YEAR_FORMAT = () =>
  dateTimeFormat({
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

// El separador de cada día de la conversación, como en las apps de
// mensajería: «Hoy», «Ayer», «3 nov» o, de otro año, «3 nov 2025»
export function messageDay(isoDate: string, now = new Date()): string {
  const date = new Date(isoDate);
  const daysAgo = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (daysAgo === 0) return translate('labels.today');
  if (daysAgo === 1) return translate('labels.yesterday');
  return (date.getFullYear() === now.getFullYear() ? DAY_FORMAT : DAY_WITH_YEAR_FORMAT)().format(
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
