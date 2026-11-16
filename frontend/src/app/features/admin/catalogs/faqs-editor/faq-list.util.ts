import { AdminFaq, AdminFaqTopic, FaqStatus } from '../../../../core/models/admin-faq.model';

export interface FaqFilters {
  // Clave del tema, o null para verlos todos
  topic: string | null;
  status: FaqStatus | null;
  search: string;
}

export interface FaqRow {
  faq: AdminFaq;
  canMoveUp: boolean;
  canMoveDown: boolean;
  // Le falta el inglés: no se puede publicar
  isTranslated: boolean;
}

export interface FaqGroup {
  topic: AdminFaqTopic;
  rows: FaqRow[];
}

// Sin tildes ni mayúsculas, para comparar lo que se busca
export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();
}

// Completa en inglés: pregunta, respuesta y los mismos puntos (lo que exige
// la API para publicarla)
export function isFaqTranslated(faq: AdminFaq): boolean {
  return (
    faq.questionEn.trim() !== '' &&
    faq.answerEn.trim() !== '' &&
    faq.pointsEn.length === faq.pointsEs.length
  );
}

function matches(faq: AdminFaq, filters: FaqFilters, search: string): boolean {
  if (filters.status !== null && faq.status !== filters.status) {
    return false;
  }
  const text = [faq.questionEs, faq.answerEs, faq.questionEn, faq.answerEn].join(' ');
  return search === '' || normalizeText(text).includes(search);
}

// Las preguntas agrupadas por tema, en el orden de los temas. Subir y bajar
// se calculan con todas las del tema (no solo las que pasan el filtro); los
// temas sin preguntas que mostrar no salen si hay algún filtro
export function groupFaqs(
  topics: readonly AdminFaqTopic[],
  faqs: readonly AdminFaq[],
  filters: FaqFilters,
): FaqGroup[] {
  const search = normalizeText(filters.search.trim());
  const isFiltering = filters.status !== null || search !== '';
  return topics
    .filter((topic) => filters.topic === null || topic.key === filters.topic)
    .map((topic) => {
      const inTopic = faqs.filter((faq) => faq.topic === topic.key);
      const rows = inTopic
        .map((faq, index) => ({
          faq,
          canMoveUp: index > 0,
          canMoveDown: index < inTopic.length - 1,
          isTranslated: isFaqTranslated(faq),
        }))
        .filter((row) => matches(row.faq, filters, search));
      return { topic, rows };
    })
    .filter((group) => group.rows.length > 0 || !isFiltering);
}

// Los puntos de una respuesta se escriben uno por línea
export function toPoints(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}
