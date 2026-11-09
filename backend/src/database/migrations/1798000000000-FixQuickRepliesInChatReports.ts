import { MigrationInterface, QueryRunner } from 'typeorm';

// Las denuncias del chat copiaban la clave de cada respuesta rápida
// («(respuesta rápida: at_pickup)») en lugar del texto que vio quien la
// recibió. Se corrige la copia guardada en las que ya existen, igual que la
// hace ahora ChatReportsService. Sin vuelta atrás: el texto antiguo no aporta
// nada
const QUICK_REPLY_COPY: Readonly<Record<string, string>> = {
  at_pickup: 'Ya estoy en el punto',
  running_late: 'Llego 5 min tarde',
  on_my_way: 'Estoy en camino',
  where_are_you: '¿Dónde estás?',
};

export class FixQuickRepliesInChatReports1798000000000 implements MigrationInterface {
  name = 'FixQuickRepliesInChatReports1798000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Una sola consulta: las cuatro sustituciones, una dentro de otra
    await queryRunner.query(
      `UPDATE incidents
          SET description = replace(replace(replace(replace(description,
                $1, $2), $3, $4), $5, $6), $7, $8)
        WHERE description LIKE 'Chat del viaje denunciado.%'
          AND description LIKE '%(respuesta rápida: %'`,
      Object.entries(QUICK_REPLY_COPY).flatMap(([key, text]) => [
        `(respuesta rápida: ${key})`,
        `${text} (respuesta rápida)`,
      ]),
    );
  }

  public async down(): Promise<void> {
    // Nada que deshacer: el texto corregido es el que debía tener
  }
}
