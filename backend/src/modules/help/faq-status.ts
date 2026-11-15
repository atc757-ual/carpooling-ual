import type { Faq } from './entities/faq.entity';
import type { FaqStatus } from './faq-values';

// Transiciones permitidas de una pregunta frecuente (RNF-10), en una única
// tabla: un borrador se publica y una publicada vuelve a borrador. Publicar
// la que ya lo está (o al revés) no es un cambio
const FAQ_TRANSITIONS: Readonly<Record<FaqStatus, readonly FaqStatus[]>> = {
  draft: ['published'],
  published: ['draft'],
};

export function canChangeFaqStatus(from: FaqStatus, to: FaqStatus): boolean {
  return FAQ_TRANSITIONS[from].includes(to);
}

// Una pregunta solo se publica completa en los dos idiomas, para que quien
// usa la app en inglés no vea huecos: pregunta, respuesta y los mismos puntos
export function isFaqTranslated(
  faq: Pick<Faq, 'questionEn' | 'answerEn' | 'pointsEs' | 'pointsEn'>,
): boolean {
  return (
    faq.questionEn.trim() !== '' &&
    faq.answerEn.trim() !== '' &&
    faq.pointsEn.length === faq.pointsEs.length
  );
}
