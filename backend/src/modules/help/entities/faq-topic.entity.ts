import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

// Tabla faq_topics: los temas (secciones) del centro de ayuda, con su nombre
// en español e inglés, su icono (de Ionicons) y su orden. La clave no cambia
@Entity('faq_topics')
export class FaqTopic {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40, unique: true })
  key: string;

  @Column({ name: 'name_es', type: 'varchar', length: 60 })
  nameEs: string;

  @Column({ name: 'name_en', type: 'varchar', length: 60 })
  nameEn: string;

  @Column({ type: 'varchar', length: 40 })
  icon: string;

  @Column({ name: 'sort_order', type: 'smallint' })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
