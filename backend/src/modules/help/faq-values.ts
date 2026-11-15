// Para quién es una pregunta: el modo conductor, el pasajero o los dos
export const FAQ_AUDIENCES = ['driver', 'passenger', 'both'] as const;
export type FaqAudience = (typeof FAQ_AUDIENCES)[number];

// Pantallas que enseñan preguntas rápidas. Una pregunta puede serlo de varias
export const FAQ_CONTEXTS = ['search', 'publish', 'support'] as const;
export type FaqContext = (typeof FAQ_CONTEXTS)[number];

// La app solo ve las publicadas; el panel prepara las demás como borrador
export const FAQ_STATUSES = ['draft', 'published'] as const;
export type FaqStatus = (typeof FAQ_STATUSES)[number];

// Idiomas de los textos: cada pregunta se guarda en los dos
export const FAQ_LANGS = ['es', 'en'] as const;
export type FaqLang = (typeof FAQ_LANGS)[number];
