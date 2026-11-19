import { translate } from '@jsverse/transloco';
import { lazyList } from '../../../core/i18n/lazy-labels';
// Ayuda de Publicar: qué pasa después de publicar (paso 3). Las preguntas
// frecuentes vienen de la API (app-quick-faqs)
export interface NextStep {
  title: string;
  text: string;
}

export function getNextSteps(autoAccept = false): readonly NextStep[] {
  return [
    {
      title: translate('screens.publishHelp.requestsTitle'),
      text: translate('screens.publishHelp.requestsText'),
    },
    autoAccept
      ? {
          title: translate('screens.publishHelp.autoAcceptTitle'),
          text: translate('screens.publishHelp.autoAcceptText'),
        }
      : {
          title: translate('screens.publishHelp.youDecideTitle'),
          text: translate('screens.publishHelp.youDecideText'),
        },
    {
      title: translate('screens.publishHelp.tripDayTitle'),
      text: translate('screens.publishHelp.tripDayText'),
    },
  ];
}

// «Gracias por compartir tu coche» (al publicar): por qué ayuda a la UAL
export const COMMUNITY_POINTS: readonly string[] = lazyList([
  'screens.publishHelp.fewerCars',
  'screens.publishHelp.sustainable',
  'screens.publishHelp.network',
]);
