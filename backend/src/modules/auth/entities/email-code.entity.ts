import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Para qué sirve el código: verificar el correo o, más adelante, recuperar la
// contraseña. Cada uno es independiente (un código de un tipo no sirve para
// el otro)
export type EmailCodePurpose = 'email_verification' | 'password_reset';

// Tabla email_codes: el código de un solo uso que se envía por correo.
// Pertenece al módulo auth, como refresh_tokens
@Entity('email_codes')
export class EmailCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Solo el id, sin relación con User (fronteras entre módulos); la clave
  // foránea con ON DELETE CASCADE está en la base de datos
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({
    type: 'enum',
    enum: ['email_verification', 'password_reset'],
    enumName: 'email_code_purpose',
  })
  purpose: EmailCodePurpose;

  // HMAC-SHA256 del código en hexadecimal (64 caracteres); nunca en claro
  @Column({ name: 'code_hash', type: 'char', length: 64 })
  codeHash: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'failed_attempts', type: 'smallint', default: 0 })
  failedAttempts: number;

  // Cuándo se envió (sirve también para el límite de reenvíos)
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
