import { MigrationInterface, QueryRunner } from 'typeorm';

// Perfil público del usuario y catálogo cerrado de avatares SVG:
// - Tabla avatars: los 12 avatares SVG de la plataforma (datos de referencia,
//   también en producción: por eso van en la migración).
// - En users: avatar_key (FK a avatars), bio («Sobre mí», 20–500 caracteres)
//   y las 4 preferencias de viaje (conversación, música, tabaco y mascotas).
export class AddPublicProfileAndAvatars1794300000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE avatars (
        key        varchar(30) PRIMARY KEY,
        name       varchar(60) NOT NULL,
        svg        text NOT NULL,
        is_active  boolean NOT NULL DEFAULT true,
        sort_order smallint NOT NULL
      );

      INSERT INTO avatars (key, name, svg, sort_order) VALUES
        ('sun', 'Sol de Almería', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="12"/><path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4.2 4.2M44.8 44.8L49 49M49 15l-4.2 4.2M19.2 44.8L15 49"/></svg>', 1),
        ('wave', 'Ola del Mediterráneo', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10 26c6-6 12-6 18 0s12 6 18 0 6-6 8-4"/><path d="M10 38c6-6 12-6 18 0s12 6 18 0 6-6 8-4"/><path d="M14 50c5-4 10-4 15 0s10 4 15 0"/></svg>', 2),
        ('cactus', 'Cactus de Cabo de Gata', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M28 52V18a4 4 0 0 1 8 0v34"/><path d="M28 36h-6a4 4 0 0 1-4-4v-8a3 3 0 0 1 6 0v6h4"/><path d="M36 32h6a4 4 0 0 0 4-4v-6a3 3 0 0 0-6 0v4h-4"/><path d="M20 52h24"/></svg>', 3),
        ('palm', 'Palmera del paseo', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M32 52V24"/><path d="M32 24c-8-8-18-6-20 0 6-2 14 0 20 0Z"/><path d="M32 24c8-8 18-6 20 0-6-2-14 0-20 0Z"/><path d="M32 24c-6-10-14-12-16-8"/><path d="M32 24c6-10 14-12 16-8"/><path d="M22 52h20"/></svg>', 4),
        ('compass', 'Brújula', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="20"/><polygon points="26,26 42,22 38,38 22,42"/></svg>', 5),
        ('car', 'Coche compartido', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 36l5-12h26l5 12"/><rect x="10" y="36" width="44" height="12" rx="4"/><circle cx="20" cy="48" r="4"/><circle cx="44" cy="48" r="4"/></svg>', 6),
        ('leaf', 'Hoja sostenible', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M48 16C28 16 16 28 16 48c20 0 32-12 32-32Z"/><path d="M16 48l20-20"/></svg>', 7),
        ('book', 'Cuaderno de campus', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 18c6-2 14-2 20 2 6-4 14-4 20-2v30c-6-2-14-2-20 2-6-4-14-4-20-2V18Z"/><path d="M32 20v30"/></svg>', 8),
        ('coffee', 'Taza de café', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 24h28v14a12 12 0 0 1-12 12h-4a12 12 0 0 1-12-12V24Z"/><path d="M42 26h4a6 6 0 0 1 0 12h-4"/><path d="M22 14v4M30 14v4M38 14v4"/></svg>', 9),
        ('headphones', 'Auriculares', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 36v-4a18 18 0 0 1 36 0v4"/><rect x="12" y="34" width="8" height="14" rx="4"/><rect x="44" y="34" width="8" height="14" rx="4"/></svg>', 10),
        ('cat', 'Gato curioso', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 26l4-12 8 8h8l8-8 4 12a16 16 0 1 1-32 0Z"/><circle cx="26" cy="32" r="1.5"/><circle cx="38" cy="32" r="1.5"/><path d="M30 38h4"/></svg>', 11),
        ('owl', 'Búho universitario', '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 18l-4-6 10 4h12l10-4-4 6a18 18 0 1 1-24 0Z"/><circle cx="26" cy="28" r="4"/><circle cx="38" cy="28" r="4"/><polygon points="30,34 34,34 32,38"/></svg>', 12);

      CREATE TYPE conversation_preference AS ENUM ('chatty', 'depends', 'quiet');
      CREATE TYPE music_preference AS ENUM ('any', 'soft', 'none');
      CREATE TYPE smoking_preference AS ENUM ('no', 'stops_only', 'allowed');
      CREATE TYPE pets_preference AS ENUM ('none', 'small_carrier', 'pet_friendly');

      ALTER TABLE users
        ADD COLUMN avatar_key varchar(30) NULL REFERENCES avatars(key),
        ADD COLUMN bio varchar(500) NULL
          CHECK (bio IS NULL OR (char_length(bio) BETWEEN 20 AND 500)),
        ADD COLUMN pref_conversation conversation_preference NULL,
        ADD COLUMN pref_music music_preference NULL,
        ADD COLUMN pref_smoking smoking_preference NULL,
        ADD COLUMN pref_pets pets_preference NULL;

      UPDATE users
         SET avatar_key = 'sun',
             bio = 'Conductora habitual desde Roquetas de Mar al campus de La Cañada.',
             pref_conversation = 'chatty',
             pref_music = 'soft',
             pref_smoking = 'no',
             pref_pets = 'small_carrier'
       WHERE id = '00000000-0000-4000-8000-000000000002';

      UPDATE users
         SET avatar_key = 'headphones',
             bio = 'Estudiante en el campus de la UAL. Puntual en las paradas.',
             pref_conversation = 'quiet',
             pref_music = 'any',
             pref_smoking = 'no',
             pref_pets = 'none'
       WHERE id = '00000000-0000-4000-8000-000000000003';

      UPDATE users
         SET pref_conversation = 'depends',
             pref_music = 'soft',
             pref_smoking = 'no'
       WHERE id = '00000000-0000-4000-8000-000000000004';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP COLUMN pref_pets,
        DROP COLUMN pref_smoking,
        DROP COLUMN pref_music,
        DROP COLUMN pref_conversation,
        DROP COLUMN bio,
        DROP COLUMN avatar_key;

      DROP TYPE pets_preference;
      DROP TYPE smoking_preference;
      DROP TYPE music_preference;
      DROP TYPE conversation_preference;
      DROP TABLE avatars;
    `);
  }
}
