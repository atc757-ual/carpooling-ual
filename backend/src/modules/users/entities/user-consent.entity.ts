import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  CONSENT_ACTIONS,
  CONSENT_SOURCES,
  CONSENT_TYPES,
} from '../user-consent';
import type {
  ConsentAction,
  ConsentSource,
  ConsentType,
} from '../user-consent';
import { User } from './user.entity';

// Fila de solo inserción en user_consents: prueba del consentimiento (RGPD).
// Nunca se modifica ni se borra una fila; retirar un consentimiento añade una
// fila nueva con action = 'revoked'
@Entity('user_consents')
export class UserConsent {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: User;

  @Column({ type: 'enum', enum: CONSENT_TYPES, enumName: 'consent_type' })
  type!: ConsentType;

  @Column({ name: 'document_version', type: 'varchar', length: 20 })
  documentVersion!: string;

  @Column({ type: 'enum', enum: CONSENT_ACTIONS, enumName: 'consent_action' })
  action!: ConsentAction;

  @Column({ type: 'enum', enum: CONSENT_SOURCES, enumName: 'consent_source' })
  source!: ConsentSource;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ type: 'varchar', length: 64 })
  fingerprint!: string;
}
