import { MigrationInterface, QueryRunner } from 'typeorm';

// Avatares subidos por el panel de administración (catálogos): además de los
// 12 SVG de la plataforma, imágenes PNG o WebP guardadas en la base de datos.
// - avatars pasa a tener un id (para sus eventos de catálogo); la clave sigue
//   siendo única y users.avatar_key sigue apuntando a ella
// - cada avatar es un SVG (de las migraciones, de confianza) o una imagen con
//   su tipo, nunca las dos cosas. No se aceptan SVG subidos
export class AddAvatarUploads1795600000000 implements MigrationInterface {
  name = 'AddAvatarUploads1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP CONSTRAINT users_avatar_key_fkey;
      ALTER TABLE avatars DROP CONSTRAINT avatars_pkey;

      ALTER TABLE avatars
        ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid(),
        ALTER COLUMN key TYPE varchar(60),
        ALTER COLUMN svg DROP NOT NULL,
        ADD COLUMN image bytea NULL,
        ADD COLUMN content_type varchar(20) NULL
          CHECK (content_type IN ('image/png', 'image/webp')),
        ADD COLUMN created_at timestamptz NOT NULL DEFAULT now(),
        ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now(),
        ADD CONSTRAINT avatars_pkey PRIMARY KEY (id),
        ADD CONSTRAINT avatars_key_key UNIQUE (key),
        ADD CONSTRAINT avatars_svg_or_image CHECK (
          (svg IS NULL) <> (image IS NULL)
          AND (image IS NULL) = (content_type IS NULL)
        );

      ALTER TABLE users
        ALTER COLUMN avatar_key TYPE varchar(60),
        ADD CONSTRAINT users_avatar_key_fkey
          FOREIGN KEY (avatar_key) REFERENCES avatars (key);
    `);
  }

  // Solo vuelve atrás sin avatares subidos (borrarlos antes)
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users DROP CONSTRAINT users_avatar_key_fkey;

      ALTER TABLE avatars
        DROP CONSTRAINT avatars_svg_or_image,
        DROP CONSTRAINT avatars_key_key,
        DROP CONSTRAINT avatars_pkey,
        DROP COLUMN updated_at,
        DROP COLUMN created_at,
        DROP COLUMN content_type,
        DROP COLUMN image,
        DROP COLUMN id,
        ALTER COLUMN svg SET NOT NULL,
        ALTER COLUMN key TYPE varchar(30),
        ADD CONSTRAINT avatars_pkey PRIMARY KEY (key);

      ALTER TABLE users
        ALTER COLUMN avatar_key TYPE varchar(30),
        ADD CONSTRAINT users_avatar_key_fkey
          FOREIGN KEY (avatar_key) REFERENCES avatars (key);
    `);
  }
}
