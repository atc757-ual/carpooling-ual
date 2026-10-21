import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

// Tabla refresh_tokens: un token de renovación de una sesión. Pertenece al
// módulo auth (es un concepto de sesión, no de usuario).
@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Solo el id y no una relación con User: auth no usa las entidades de users
  // (fronteras entre módulos). La clave foránea con ON DELETE CASCADE sí está
  // en la base de datos: al borrar un usuario se borran sus sesiones
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  // Todos los tokens de una misma sesión (desde un login) comparten familia
  @Column({ name: 'family_id', type: 'uuid' })
  familyId: string;

  // SHA-256 del token en hexadecimal (64 caracteres); el token nunca se guarda
  @Column({ name: 'token_hash', type: 'char', length: 64, unique: true })
  tokenHash: string;

  // Caducidad de este token: 7 días deslizantes, sin pasar del tope
  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  // Tope de la sesión (30 días desde el login); se copia de token en token
  @Column({ name: 'session_expires_at', type: 'timestamptz' })
  sessionExpiresAt: Date;

  // Cuándo se cambió por uno nuevo (rotación). Si llega de nuevo, es una
  // reutilización: señal de que lo han robado
  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt: Date | null;

  // Cuándo se anuló (logout o reutilización detectada)
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
