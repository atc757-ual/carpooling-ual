import type { AppLanguage } from '../../../shared/i18n/app-language';
import { DEFAULT_LANGUAGE } from '../../../shared/i18n/app-language';
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

  // El idioma de la app en este dispositivo: el de sus push
  @Column({ type: 'varchar', length: 2, default: DEFAULT_LANGUAGE })
  language: AppLanguage;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @Column({ name: 'last_seen_at', type: 'timestamptz' })
  lastSeenAt: Date;
}
