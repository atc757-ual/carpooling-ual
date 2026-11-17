import {
  carOutline,
  chatbubblesOutline,
  closeCircleOutline,
  helpCircleOutline,
  lockClosedOutline,
  navigateOutline,
  personCircleOutline,
  searchOutline,
  shieldCheckmarkOutline,
  thumbsUpOutline,
  ticketOutline,
} from 'ionicons/icons';
import { HelpFaq, HelpTopic } from '../../../core/models/faq.model';

// Ayuda y soporte; cada pregunta, en HELP_CENTER_PATH/:id
export const HELP_CENTER_PATH = '/tabs/profile/help';

// Los iconos que puede llevar un tema (el panel guarda su nombre de
// Ionicons); uno que no esté aquí sale con el de ayuda
const TOPIC_ICONS: Readonly<Record<string, string>> = {
  'car-outline': carOutline,
  'chatbubbles-outline': chatbubblesOutline,
  'close-circle-outline': closeCircleOutline,
  'help-circle-outline': helpCircleOutline,
  'lock-closed-outline': lockClosedOutline,
  'navigate-outline': navigateOutline,
  'person-circle-outline': personCircleOutline,
  'search-outline': searchOutline,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  'thumbs-up-outline': thumbsUpOutline,
  'ticket-outline': ticketOutline,
};

export function topicIcon(name: string): string {
  return TOPIC_ICONS[name] ?? helpCircleOutline;
}

export interface HelpGroup {
  topic: HelpTopic;
  icon: string;
  faqs: HelpFaq[];
}

// Las preguntas por tema, en el orden de los temas; solo los temas que
// tienen alguna
export function groupByTopic(topics: readonly HelpTopic[], faqs: readonly HelpFaq[]): HelpGroup[] {
  return topics
    .map((topic) => ({
      topic,
      icon: topicIcon(topic.icon),
      faqs: faqs.filter((faq) => faq.topic === topic.key),
    }))
    .filter((group) => group.faqs.length > 0);
}
