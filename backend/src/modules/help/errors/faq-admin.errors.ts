import { BusinessError } from '../../../shared/errors/business-error';
import type { FaqStatus } from '../faq-values';

// No hay ningún tema con esa clave. La capa API lo traduce a un 404
// (FAQ_TOPIC_NOT_FOUND)
export class FaqTopicNotFoundError extends BusinessError {
  constructor(readonly topicKey: string) {
    super(
      'FAQ_TOPIC_NOT_FOUND',
      'not_found',
      `There is no FAQ topic ${topicKey}`,
    );
  }
}

// Publicar una pregunta ya publicada o pasar a borrador un borrador. La capa
// API lo traduce a un 409 (INVALID_FAQ_TRANSITION)
export class InvalidFaqTransitionError extends BusinessError {
  constructor(
    readonly from: FaqStatus,
    readonly to: FaqStatus,
  ) {
    super(
      'INVALID_FAQ_TRANSITION',
      'conflict',
      `A FAQ cannot go from ${from} to ${to}`,
    );
  }
}

// Una pregunta publicada no se borra: primero vuelve a borrador (su enlace
// puede estar compartido). La capa API lo traduce a un 409
// (FAQ_PUBLISHED_NOT_DELETABLE)
export class FaqPublishedNotDeletableError extends BusinessError {
  constructor(readonly faqId: string) {
    super(
      'FAQ_PUBLISHED_NOT_DELETABLE',
      'conflict',
      `The FAQ ${faqId} is published: unpublish it before deleting it`,
    );
  }
}

// Publicar (o dejar publicada) una pregunta sin su texto en inglés completo.
// La capa API lo traduce a un 409 (FAQ_TRANSLATION_MISSING)
export class FaqTranslationMissingError extends BusinessError {
  constructor(readonly faqId: string) {
    super(
      'FAQ_TRANSLATION_MISSING',
      'conflict',
      `The FAQ ${faqId} needs its question, answer and points in English to be published`,
    );
  }
}
