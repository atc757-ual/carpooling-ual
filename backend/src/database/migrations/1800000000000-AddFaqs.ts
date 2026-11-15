import { MigrationInterface, QueryRunner } from 'typeorm';
import { INITIAL_FAQ_TOPICS, INITIAL_FAQS } from './data/initial-faqs';

// Centro de ayuda (pedido por el autor el 15/11/2026): las preguntas
// frecuentes pasan del frontend a la base de datos para gestionarlas desde el
// panel.
// - faq_topics: los temas, con su nombre en español e inglés
// - faqs: cada pregunta en los dos idiomas, a quién va (conductor, pasajero o
//   los dos), de qué pantallas es pregunta rápida y si está publicada
// - unaccent: para buscar sin tildes (?q=)
// Carga los temas y las preguntas que la app ya mostraba, publicadas
export class AddFaqs1800000000000 implements MigrationInterface {
  name = 'AddFaqs1800000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS unaccent`);
    await queryRunner.query(`
      CREATE TABLE faq_topics (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key varchar(40) NOT NULL UNIQUE,
        name_es varchar(60) NOT NULL,
        name_en varchar(60) NOT NULL,
        icon varchar(40) NOT NULL,
        sort_order smallint NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE faqs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        topic_id uuid NOT NULL REFERENCES faq_topics (id) ON DELETE RESTRICT,
        sort_order smallint NOT NULL,
        audience varchar(10) NOT NULL
          CONSTRAINT chk_faqs_audience
          CHECK (audience IN ('driver', 'passenger', 'both')),
        quick_contexts text[] NOT NULL DEFAULT '{}'
          CONSTRAINT chk_faqs_quick_contexts
          CHECK (quick_contexts <@ ARRAY['search', 'publish', 'support']),
        question_es varchar(160) NOT NULL,
        question_en varchar(160) NOT NULL,
        answer_es text NOT NULL,
        answer_en text NOT NULL,
        points_es text[] NOT NULL DEFAULT '{}',
        points_en text[] NOT NULL DEFAULT '{}',
        status varchar(10) NOT NULL DEFAULT 'draft'
          CONSTRAINT chk_faqs_status CHECK (status IN ('draft', 'published')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX idx_faqs_topic_order ON faqs (topic_id, sort_order)`,
    );
    await this.loadInitialFaqs(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE faqs`);
    await queryRunner.query(`DROP TABLE faq_topics`);
    await queryRunner.query(`DROP EXTENSION IF EXISTS unaccent`);
  }

  private async loadInitialFaqs(queryRunner: QueryRunner): Promise<void> {
    const topicRows = INITIAL_FAQ_TOPICS.map((topic, index) => ({
      ...topic,
      sortOrder: index + 1,
    }));
    await queryRunner.query(
      `INSERT INTO faq_topics (key, name_es, name_en, icon, sort_order)
       SELECT * FROM jsonb_to_recordset($1::jsonb)
         AS t ("key" text, "nameEs" text, "nameEn" text, "icon" text, "sortOrder" smallint)`,
      [JSON.stringify(topicRows)],
    );

    // El orden dentro de cada tema es el de la lista
    const nextOrder = new Map<string, number>();
    const faqRows = INITIAL_FAQS.map((faq) => {
      const sortOrder = (nextOrder.get(faq.topic) ?? 0) + 1;
      nextOrder.set(faq.topic, sortOrder);
      return {
        ...faq,
        pointsEs: faq.pointsEs ?? [],
        pointsEn: faq.pointsEn ?? [],
        sortOrder,
      };
    });
    await queryRunner.query(
      `INSERT INTO faqs (
         topic_id, sort_order, audience, quick_contexts, question_es,
         question_en, answer_es, answer_en, points_es, points_en, status
       )
       SELECT topic.id, f."sortOrder", f."audience", ARRAY[f."context"],
              f."questionEs", f."questionEn", f."answerEs", f."answerEn",
              ARRAY(SELECT jsonb_array_elements_text(f."pointsEs")),
              ARRAY(SELECT jsonb_array_elements_text(f."pointsEn")),
              'published'
       FROM jsonb_to_recordset($1::jsonb) AS f (
         "topic" text, "sortOrder" smallint, "audience" text, "context" text,
         "questionEs" text, "questionEn" text, "answerEs" text,
         "answerEn" text, "pointsEs" jsonb, "pointsEn" jsonb
       )
       JOIN faq_topics topic ON topic.key = f."topic"`,
      [JSON.stringify(faqRows)],
    );
  }
}
