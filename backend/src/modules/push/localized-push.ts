import { translate } from '../../shared/i18n/translate';
import type { LocalizedPushMessage } from './push.service';

// Una push con sus textos (push.<clave> de src/i18n, con sus valores) en cada
// idioma de la app y los mismos datos para abrir la pantalla al pulsarla
export function localizedPush(
  key: string,
  data: Record<string, string>,
  values: Record<string, string> = {},
): LocalizedPushMessage {
  const messageIn = (language: 'es' | 'en') => ({
    title: translate(language, `push.${key}.title`, values),
    body: translate(language, `push.${key}.body`, values),
    data,
  });
  return { es: messageIn('es'), en: messageIn('en') };
}
