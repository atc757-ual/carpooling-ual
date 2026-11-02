import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { ValueTransformer } from 'typeorm';
import type { DomainEventType } from '../domain-event-type';

// PostgreSQL devuelve bigint como texto; la secuencia cabe en un number
const BIGINT_AS_NUMBER: ValueTransformer = {
  to: (value: number | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

// Tabla events: un cambio de estado de una entidad de la plataforma (RNF-08),
// con el sobre común de DP-05 (identificador, secuencia, tipo, versión,
// entidad de origen, contenido y marca temporal). El Gemelo Digital los
// consume en orden de secuencia (docs/api/events.md)
@Entity('events')
export class DomainEvent {
  // Lo genera la aplicación (no la base de datos): el Gemelo Digital lo usa
  // para descartar eventos duplicados (RNF-11)
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  // Número creciente que pone la base de datos al guardarlo (no se escribe)
  @Column({
    type: 'bigint',
    insert: false,
    update: false,
    transformer: BIGINT_AS_NUMBER,
  })
  sequence: number;

  @Column({ type: 'varchar', length: 60 })
  type: DomainEventType;

  // Versión del contrato de su tipo (event-versions.ts)
  @Column({ type: 'smallint', default: 1 })
  version: number;

  // Referencia lógica (sin clave foránea) a la entidad que lo origina
  @Column({ name: 'source_entity_id', type: 'uuid' })
  sourceEntityId: string;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;
}
