import { helpCircleOutline, ticketOutline } from 'ionicons/icons';
import { HelpFaq, HelpTopic } from '../../../core/models/faq.model';
import { groupByTopic, topicIcon } from './help-center.util';

const TOPICS: HelpTopic[] = [
  { id: 't1', key: 'search', name: 'Buscar y pedir plaza', icon: 'ticket-outline' },
  { id: 't2', key: 'publish', name: 'Publicar y conducir', icon: 'car-outline' },
  { id: 't3', key: 'privacy', name: 'Privacidad', icon: 'lock-closed-outline' },
];

function faq(id: string, topic: string): HelpFaq {
  return {
    id,
    topic,
    audience: 'both',
    quickContexts: [],
    question: `¿${id}?`,
    answer: id,
    points: [],
  };
}

describe('help center utils', () => {
  it('gives the icon of the topic, or the help one if it is unknown', () => {
    expect(topicIcon('ticket-outline')).toBe(ticketOutline);
    expect(topicIcon('rocket-outline')).toBe(helpCircleOutline);
  });

  it('groups the questions in the order of the topics, leaving out empty topics', () => {
    const groups = groupByTopic(TOPICS, [
      faq('b', 'privacy'),
      faq('a', 'search'),
      faq('c', 'search'),
    ]);

    expect(groups.map((group) => group.topic.key)).toEqual(['search', 'privacy']);
    expect(groups[0].faqs.map((item) => item.id)).toEqual(['a', 'c']);
    expect(groups[0].icon).toBe(ticketOutline);
  });
});
