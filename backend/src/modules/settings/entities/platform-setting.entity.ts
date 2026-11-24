import { Column, Entity, PrimaryColumn } from 'typeorm';

// Un ajuste de la plataforma: su valor (JSON, tipado en PlatformSettings)
// y quién lo cambió por última vez y cuándo (sin fecha: el valor de la
// migración; sin quién: su cuenta ya no existe)
@Entity('platform_settings')
export class PlatformSetting {
  @PrimaryColumn({ type: 'varchar', length: 60 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ name: 'updated_at', type: 'timestamptz', nullable: true })
  updatedAt: Date | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;
}
