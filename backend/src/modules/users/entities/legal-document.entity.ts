import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const LEGAL_DOCUMENT_TYPES = [
  'terms',
  'privacy',
  'driver_declaration',
] as const;
export type LegalDocumentType = (typeof LEGAL_DOCUMENT_TYPES)[number];

// Los que se aceptan al registrarse y bloquean la app tras un cambio
// importante; la declaración del conductor se pide en su flujo (al publicar)
export const SIGNUP_DOCUMENT_TYPES = ['terms', 'privacy'] as const;
export type SignupDocumentType = (typeof SIGNUP_DOCUMENT_TYPES)[number];

export const LEGAL_DOCUMENT_STATUSES = ['draft', 'published'] as const;
export type LegalDocumentStatus = (typeof LEGAL_DOCUMENT_STATUSES)[number];

// major: sube la versión mayor (1.x → 2.0) y hay que volver a aceptarla;
// minor: sube la menor (1.0 → 1.1) y solo se avisa
export const LEGAL_CHANGE_TYPES = ['major', 'minor'] as const;
export type LegalChangeType = (typeof LEGAL_CHANGE_TYPES)[number];

// Tabla legal_documents: cada versión de las condiciones de uso y de la
// política de privacidad. El panel edita un borrador (uno por documento) y lo
// publica; la publicada más reciente es la vigente. El contenido se guarda ya
// saneado (legal-html.ts). Una versión publicada ya no cambia (lo impide un
// trigger de la base de datos)
@Entity('legal_documents')
export class LegalDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20 })
  type: LegalDocumentType;

  // «1.0», «1.1»…
  @Column({ type: 'varchar', length: 20 })
  version: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 20 })
  status: LegalDocumentStatus;

  @Column({ name: 'change_type', type: 'varchar', length: 10 })
  changeType: LegalChangeType;

  // «Qué ha cambiado» (lo escribe quien publica; se muestra encima del texto)
  @Column({ type: 'text', nullable: true })
  summary: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ name: 'published_by', type: 'uuid', nullable: true })
  publishedBy: string | null;
}
