import { FaqAudience, FaqContext } from './admin-faq.model';

export type FaqLang = 'es' | 'en';

// Para quién se piden las preguntas (las de «los dos» salen siempre)
export type HelpAudience = 'driver' | 'passenger';

// Un tema del centro de ayuda, en el idioma pedido
export interface HelpTopic {
  id: string;
  key: string;
  name: string;
  // Nombre del icono en Ionicons
  icon: string;
}

// Una pregunta frecuente publicada, en el idioma pedido (API /faqs)
export interface HelpFaq {
  id: string;
  // La clave de su tema
  topic: string;
  audience: FaqAudience;
  quickContexts: FaqContext[];
  question: string;
  answer: string;
  points: string[];
}

// Qué preguntas se piden: las de un modo (con las de los dos), las rápidas de
// una pantalla o las que contienen un texto
export interface HelpFaqQuery {
  lang: FaqLang;
  audience?: HelpAudience;
  context?: FaqContext;
  q?: string;
}
