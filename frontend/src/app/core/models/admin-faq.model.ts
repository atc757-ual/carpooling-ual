// Preguntas frecuentes en el panel de administración (API /admin/faqs)
export type FaqAudience = 'driver' | 'passenger' | 'both';
export type FaqContext = 'search' | 'publish' | 'support';
export type FaqStatus = 'draft' | 'published';

export interface AdminFaqTopic {
  id: string;
  key: string;
  nameEs: string;
  nameEn: string;
  icon: string;
  sortOrder: number;
}

// Lo que el panel puede cambiar de un tema
export type AdminFaqTopicFields = Pick<AdminFaqTopic, 'nameEs' | 'nameEn' | 'icon'>;

// Una pregunta con sus dos idiomas, publicada o no
export interface AdminFaq {
  id: string;
  // La clave de su tema
  topic: string;
  sortOrder: number;
  audience: FaqAudience;
  // Pantallas que la enseñan como pregunta rápida
  quickContexts: FaqContext[];
  questionEs: string;
  questionEn: string;
  answerEs: string;
  answerEn: string;
  pointsEs: string[];
  pointsEn: string[];
  status: FaqStatus;
  updatedAt: string;
}

// Lo que se envía al crear o cambiar una pregunta
export type AdminFaqFields = Pick<
  AdminFaq,
  | 'topic'
  | 'audience'
  | 'quickContexts'
  | 'questionEs'
  | 'questionEn'
  | 'answerEs'
  | 'answerEn'
  | 'pointsEs'
  | 'pointsEn'
>;

export const FAQ_AUDIENCE_LABELS: Record<FaqAudience, string> = {
  both: 'Todos',
  driver: 'Conductor',
  passenger: 'Pasajero',
};

export const FAQ_CONTEXT_LABELS: Record<FaqContext, string> = {
  search: 'Buscar',
  publish: 'Publicar',
  support: 'Ayuda y soporte',
};
