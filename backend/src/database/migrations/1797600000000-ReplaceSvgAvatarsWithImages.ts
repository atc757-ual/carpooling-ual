import { MigrationInterface, QueryRunner } from 'typeorm';
import { readDefaultAvatars } from '../avatar-files';

const SVG_KEYS = [
  'sun',
  'wave',
  'cactus',
  'palm',
  'compass',
  'car',
  'leaf',
  'book',
  'coffee',
  'headphones',
  'cat',
  'owl',
];

const SVG_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">';

// [clave, nombre, formas] de los SVG, para volver atrás
const SVG_AVATARS: readonly [string, string, string][] = [
  [
    'sun',
    'Sol de Almería',
    '<circle cx="32" cy="32" r="12"/><path d="M32 8v6M32 50v6M8 32h6M50 32h6M15 15l4.2 4.2M44.8 44.8L49 49M49 15l-4.2 4.2M19.2 44.8L15 49"/>',
  ],
  [
    'wave',
    'Ola del Mediterráneo',
    '<path d="M10 26c6-6 12-6 18 0s12 6 18 0 6-6 8-4"/><path d="M10 38c6-6 12-6 18 0s12 6 18 0 6-6 8-4"/><path d="M14 50c5-4 10-4 15 0s10 4 15 0"/>',
  ],
  [
    'cactus',
    'Cactus de Cabo de Gata',
    '<path d="M28 52V18a4 4 0 0 1 8 0v34"/><path d="M28 36h-6a4 4 0 0 1-4-4v-8a3 3 0 0 1 6 0v6h4"/><path d="M36 32h6a4 4 0 0 0 4-4v-6a3 3 0 0 0-6 0v4h-4"/><path d="M20 52h24"/>',
  ],
  [
    'palm',
    'Palmera del paseo',
    '<path d="M32 52V24"/><path d="M32 24c-8-8-18-6-20 0 6-2 14 0 20 0Z"/><path d="M32 24c8-8 18-6 20 0-6-2-14 0-20 0Z"/><path d="M32 24c-6-10-14-12-16-8"/><path d="M32 24c6-10 14-12 16-8"/><path d="M22 52h20"/>',
  ],
  [
    'compass',
    'Brújula',
    '<circle cx="32" cy="32" r="20"/><polygon points="26,26 42,22 38,38 22,42"/>',
  ],
  [
    'car',
    'Coche compartido',
    '<path d="M14 36l5-12h26l5 12"/><rect x="10" y="36" width="44" height="12" rx="4"/><circle cx="20" cy="48" r="4"/><circle cx="44" cy="48" r="4"/>',
  ],
  [
    'leaf',
    'Hoja sostenible',
    '<path d="M48 16C28 16 16 28 16 48c20 0 32-12 32-32Z"/><path d="M16 48l20-20"/>',
  ],
  [
    'book',
    'Cuaderno de campus',
    '<path d="M12 18c6-2 14-2 20 2 6-4 14-4 20-2v30c-6-2-14-2-20 2-6-4-14-4-20-2V18Z"/><path d="M32 20v30"/>',
  ],
  [
    'coffee',
    'Taza de café',
    '<path d="M14 24h28v14a12 12 0 0 1-12 12h-4a12 12 0 0 1-12-12V24Z"/><path d="M42 26h4a6 6 0 0 1 0 12h-4"/><path d="M22 14v4M30 14v4M38 14v4"/>',
  ],
  [
    'headphones',
    'Auriculares',
    '<path d="M14 36v-4a18 18 0 0 1 36 0v4"/><rect x="12" y="34" width="8" height="14" rx="4"/><rect x="44" y="34" width="8" height="14" rx="4"/>',
  ],
  [
    'cat',
    'Gato curioso',
    '<path d="M16 26l4-12 8 8h8l8-8 4 12a16 16 0 1 1-32 0Z"/><circle cx="26" cy="32" r="1.5"/><circle cx="38" cy="32" r="1.5"/><path d="M30 38h4"/>',
  ],
  [
    'owl',
    'Búho universitario',
    '<path d="M20 18l-4-6 10 4h12l10-4-4 6a18 18 0 1 1-24 0Z"/><circle cx="26" cy="28" r="4"/><circle cx="38" cy="28" r="4"/><polygon points="30,34 34,34 32,38"/>',
  ],
];

// Los avatares de la plataforma pasan a ser las 28 imágenes de
// database/avatars/ (datos de referencia, también en producción): los 12 SVG
// se eliminan y quien tenía uno vuelve a sus iniciales. Una clave que ya
// exista (subida por el panel) se respeta. down restaura los SVG, pero no la
// elección de cada usuario
export class ReplaceSvgAvatarsWithImages1797600000000 implements MigrationInterface {
  name = 'ReplaceSvgAvatarsWithImages1797600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE users SET avatar_key = NULL WHERE avatar_key = ANY($1)`,
      [SVG_KEYS],
    );
    await queryRunner.query(`DELETE FROM avatars WHERE key = ANY($1)`, [
      SVG_KEYS,
    ]);
    const avatars = readDefaultAvatars();
    await queryRunner.query(
      `INSERT INTO avatars (key, name, image, content_type, sort_order)
       SELECT key, name, image, 'image/png', sort_order
         FROM unnest($1::varchar[], $2::varchar[], $3::bytea[], $4::smallint[])
           AS avatar (key, name, image, sort_order)
       ON CONFLICT (key) DO NOTHING`,
      [
        avatars.map(({ key }) => key),
        avatars.map(({ name }) => name),
        avatars.map(({ image }) => image),
        avatars.map(({ sortOrder }) => sortOrder),
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const keys = readDefaultAvatars().map(({ key }) => key);
    await queryRunner.query(
      `UPDATE users SET avatar_key = NULL WHERE avatar_key = ANY($1)`,
      [keys],
    );
    await queryRunner.query(`DELETE FROM avatars WHERE key = ANY($1)`, [keys]);
    await queryRunner.query(
      `INSERT INTO avatars (key, name, svg, sort_order)
       SELECT key, name, svg, sort_order
         FROM unnest($1::varchar[], $2::varchar[], $3::text[], $4::smallint[])
           AS avatar (key, name, svg, sort_order)`,
      [
        SVG_AVATARS.map(([key]) => key),
        SVG_AVATARS.map(([, name]) => name),
        SVG_AVATARS.map(([, , shapes]) => `${SVG_OPEN}${shapes}</svg>`),
        SVG_AVATARS.map((_, index) => index + 1),
      ],
    );
  }
}
