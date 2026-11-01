import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { AdminActionType } from '../admin-action-type';

// Auditoría de las acciones de los administradores: quién, qué, a quién, por
// qué y cuándo. El motivo es texto libre: se guarda aquí y no en el evento
// del Gemelo Digital (minimización)
@Entity('admin_actions')
export class AdminAction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'admin_id', type: 'uuid', nullable: true })
  adminId: string | null;

  @Column({ type: 'varchar', length: 60 })
  action: AdminActionType;

  @Column({ name: 'target_user_id', type: 'uuid', nullable: true })
  targetUserId: string | null;

  // Detalle de la acción sin datos personales (p. ej. el perfil o el papel)
  @Column({ type: 'jsonb', default: {} })
  details: Record<string, unknown>;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
