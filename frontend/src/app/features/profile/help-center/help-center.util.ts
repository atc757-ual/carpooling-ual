import { HelpFaq, HelpTopic } from '../../../core/models/faq.model';
import { topicIcon } from '../../../shared/utils/faq-topic-icons.util';

// El icono de cada tema, en shared (también lo usa el panel)
export { topicIcon } from '../../../shared/utils/faq-topic-icons.util';

// Ayuda y soporte; cada pregunta, en HELP_CENTER_PATH/:id
export const HELP_CENTER_PATH = '/tabs/profile/help';
// ?incident=<id>: abre la ventana de esa incidencia mía (desde su aviso)
export const HELP_INCIDENT_PARAM = 'incident';

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
