import { MigrationInterface, QueryRunner } from 'typeorm';

// «Sobre mí», de 20 a 200 caracteres (antes 500): una presentación breve. Los
// más largos se recortan a 200
export class LimitBioTo2001794900000000 implements MigrationInterface {
  name = 'LimitBioTo2001794900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE users SET bio = rtrim(left(bio, 200)) WHERE char_length(bio) > 200;
      ALTER TABLE users
        DROP CONSTRAINT users_bio_check,
        ALTER COLUMN bio TYPE varchar(200),
        ADD CONSTRAINT users_bio_check
          CHECK (bio IS NULL OR (char_length(bio) BETWEEN 20 AND 200))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE users
        DROP CONSTRAINT users_bio_check,
        ALTER COLUMN bio TYPE varchar(500),
        ADD CONSTRAINT users_bio_check
          CHECK (bio IS NULL OR (char_length(bio) BETWEEN 20 AND 500))
    `);
  }
}
