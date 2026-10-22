import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { DomainEventType } from '../domain-event-type';

// Tabla events: un cambio de estado de una entidad de la plataforma (RNF-08).
// Sigue el sobre provisional de DP-05 (identificador, tipo, entidad de origen,
// contenido y marca temporal); el Gemelo Digital los consumirá en orden
@Entity('events')
export class DomainEvent {
  // Lo genera la aplicación (no la base de datos): el Gemelo Digital lo usa
  // para descartar eventos duplicados (RNF-11)
  @PrimaryColumn({ type: 'uuid' })
  id: string;

  @Column({ type: 'varchar', length: 60 })
  type: DomainEventType;

  // Referencia lógica (sin clave foránea) a la entidad que lo origina
  @Column({ name: 'source_entity_id', type: 'uuid' })
  sourceEntityId: string;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, unknown>;

  @CreateDateColumn({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;
}
