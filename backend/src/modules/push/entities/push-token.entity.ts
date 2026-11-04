import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export const PUSH_PLATFORMS = ['web', 'android'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

// Tabla push_tokens: dónde recibe las push un usuario (un token por
// dispositivo o navegador). Solo el id del usuario, sin relación con su
// entidad (fronteras entre módulos)
@Entity('push_tokens')
export class PushToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 4096, unique: true })
  token: string;

  @Column({ type: 'varchar', length: 10 })
  platform: PushPlatform;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;
}
