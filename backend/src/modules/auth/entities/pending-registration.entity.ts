import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Tabla pending_registrations: un registro hasta que se verifica el correo. El
// usuario (tabla users) solo se crea al verificarlo. Pertenece al módulo auth
@Entity('pending_registrations')
export class PendingRegistration {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'citext', unique: true })
  email: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  phone: string;

  @Column({ name: 'password_hash', type: 'text' })
  passwordHash: string;

  @Column({ name: 'terms_accepted_at', type: 'timestamptz' })
  termsAcceptedAt: Date;

  // HMAC-SHA256 del código en hexadecimal (64 caracteres); nunca en claro
  @Column({ name: 'code_hash', type: 'char', length: 64 })
  codeHash: string;

  @Column({ name: 'code_expires_at', type: 'timestamptz' })
  codeExpiresAt: Date;

  @Column({ name: 'failed_attempts', type: 'smallint', default: 0 })
  failedAttempts: number;

  // Cuándo se envió el último código (límite de reenvíos)
  @Column({ name: 'code_sent_at', type: 'timestamptz' })
  codeSentAt: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
