import {
  carOutline,
  chatbubblesOutline,
  closeCircleOutline,
  helpCircleOutline,
  lockClosedOutline,
  medalOutline,
  navigateOutline,
  personCircleOutline,
  searchOutline,
  shieldCheckmarkOutline,
  thumbsUpOutline,
  ticketOutline,
} from 'ionicons/icons';

// Los iconos que puede llevar un tema de las preguntas frecuentes (el panel
// guarda su nombre de Ionicons): los muestra Ayuda y los ofrece el editor de
// temas del panel. Uno que no esté aquí sale con el de ayuda
const TOPIC_ICONS: Readonly<Record<string, string>> = {
  'car-outline': carOutline,
  'chatbubbles-outline': chatbubblesOutline,
  'close-circle-outline': closeCircleOutline,
  'help-circle-outline': helpCircleOutline,
  'lock-closed-outline': lockClosedOutline,
  // La de las valoraciones: la escala es de medallas (RF-22)
  'medal-outline': medalOutline,
  'navigate-outline': navigateOutline,
  'person-circle-outline': personCircleOutline,
  'search-outline': searchOutline,
  'shield-checkmark-outline': shieldCheckmarkOutline,
  'thumbs-up-outline': thumbsUpOutline,
  'ticket-outline': ticketOutline,
};

// Los nombres que se pueden elegir, en el orden en que se ofrecen
export const FAQ_TOPIC_ICON_NAMES: readonly string[] = Object.keys(TOPIC_ICONS);

export function topicIcon(name: string): string {
  return TOPIC_ICONS[name] ?? helpCircleOutline;
}
