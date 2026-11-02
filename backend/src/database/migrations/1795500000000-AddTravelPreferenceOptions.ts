import { MigrationInterface, QueryRunner } from 'typeorm';

// Catálogo de las opciones de las preferencias de viaje (panel de
// administración, catálogos): sus textos en español e inglés y si se
// ofrecen. Los valores son los de siempre (users.*_preference): el panel no
// los crea ni los borra, porque el código y el matching dependen de ellos
export class AddTravelPreferenceOptions1795500000000 implements MigrationInterface {
  name = 'AddTravelPreferenceOptions1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE travel_preference_options (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        key        varchar(60) NOT NULL UNIQUE,
        preference varchar(20) NOT NULL
                   CHECK (preference IN ('conversation', 'music', 'smoking', 'pets')),
        value      varchar(30) NOT NULL,
        name       varchar(60) NOT NULL CHECK (length(trim(name)) > 0),
        name_en    varchar(60) NOT NULL CHECK (length(trim(name_en)) > 0),
        is_active  boolean NOT NULL DEFAULT true,
        sort_order smallint NOT NULL CHECK (sort_order >= 0),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        UNIQUE (preference, value)
      );

      INSERT INTO travel_preference_options
        (key, preference, value, name, name_en, sort_order) VALUES
        ('conversation-chatty',  'conversation', 'chatty',        'Charlar',        'Chatting',           0),
        ('conversation-depends', 'conversation', 'depends',       'Según el día',   'Depends on the day', 1),
        ('conversation-quiet',   'conversation', 'quiet',         'Ir tranquilo',   'Quiet trip',         2),
        ('music-any',            'music',        'any',           'Con música',     'With music',         3),
        ('music-soft',           'music',        'soft',          'Música suave',   'Soft music',         4),
        ('music-none',           'music',        'none',          'Sin música',     'No music',           5),
        ('smoking-no',           'smoking',      'no',            'No se fuma',     'No smoking',         6),
        ('smoking-allowed',      'smoking',      'allowed',       'Se puede fumar', 'Smoking allowed',    7),
        ('pets-none',            'pets',         'none',          'Sin mascotas',   'No pets',            8),
        ('pets-small-carrier',   'pets',         'small_carrier', 'En transportín', 'In a carrier',       9),
        ('pets-pet-friendly',    'pets',         'pet_friendly',  'Pet friendly',   'Pet friendly',       10);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE travel_preference_options');
  }
}
