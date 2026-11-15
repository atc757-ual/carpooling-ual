import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import type { Page, PageRequest } from '../../shared/pagination/page';
import { FaqTopic } from './entities/faq-topic.entity';
import { Faq } from './entities/faq.entity';
import { FaqNotFoundError } from './errors/faq-not-found.error';
import type { FaqAudience, FaqContext, FaqLang } from './faq-values';

export interface FaqFilters {
  lang: FaqLang;
  context?: FaqContext;
  audience?: FaqAudience;
  topic?: string;
  q?: string;
}

// Columnas en las que busca ?q= según el idioma (nombres fijos, nunca del
// cliente): la pregunta, la respuesta y sus puntos
const SEARCH_TEXT: Record<FaqLang, string> = {
  es: `faq.question_es || ' ' || faq.answer_es || ' ' || array_to_string(faq.points_es, ' ')`,
  en: `faq.question_en || ' ' || faq.answer_en || ' ' || array_to_string(faq.points_en, ' ')`,
};

// Los comodines de LIKE que escriba el usuario se buscan como texto
export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, String.raw`\$&`);
}

// Lectura de las preguntas frecuentes para la app: solo las publicadas, en
// el orden de los temas y, dentro de cada uno, en el suyo
@Injectable()
export class FaqsService {
  constructor(
    @InjectRepository(Faq) private readonly faqs: Repository<Faq>,
    @InjectRepository(FaqTopic)
    private readonly topics: Repository<FaqTopic>,
  ) {}

  listTopics(): Promise<FaqTopic[]> {
    return this.topics.find({ order: { sortOrder: 'ASC', key: 'ASC' } });
  }

  async listPublished(
    filters: FaqFilters,
    page: PageRequest,
  ): Promise<Page<Faq>> {
    const query = this.published();
    this.applyFilters(query, filters);
    const [items, total] = await query
      .orderBy('topic.sortOrder', 'ASC')
      .addOrderBy('faq.sortOrder', 'ASC')
      .addOrderBy('faq.id', 'ASC')
      .skip(page.offset)
      .take(page.limit)
      .getManyAndCount();
    return { items, total };
  }

  async getPublished(id: string): Promise<Faq> {
    const faq = await this.published()
      .andWhere('faq.id = :id', { id })
      .getOne();
    if (faq === null) {
      throw new FaqNotFoundError(id);
    }
    return faq;
  }

  private published(): SelectQueryBuilder<Faq> {
    return this.faqs
      .createQueryBuilder('faq')
      .innerJoinAndSelect('faq.topic', 'topic')
      .where(`faq.status = 'published'`);
  }

  private applyFilters(
    query: SelectQueryBuilder<Faq>,
    filters: FaqFilters,
  ): void {
    if (filters.context !== undefined) {
      query.andWhere(':context = ANY(faq.quick_contexts)', {
        context: filters.context,
      });
    }
    if (filters.audience !== undefined) {
      // Las de los dos modos valen para cualquiera de ellos
      query.andWhere('faq.audience IN (:...audiences)', {
        audiences: [filters.audience, 'both'],
      });
    }
    if (filters.topic !== undefined) {
      query.andWhere('topic.key = :topic', { topic: filters.topic });
    }
    if (filters.q !== undefined) {
      query.andWhere(
        `unaccent(${SEARCH_TEXT[filters.lang]}) ILIKE unaccent(:pattern)`,
        { pattern: `%${escapeLike(filters.q)}%` },
      );
    }
  }
}
