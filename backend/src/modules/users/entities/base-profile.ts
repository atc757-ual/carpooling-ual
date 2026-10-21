import {
  Column,
  CreateDateColumn,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

// Atributos comunes a los tres perfiles: es la clase abstracta Perfil del
// diagrama de clases de la memoria. No es una tabla: cada perfil concreto
// (conductor, pasajero, administrador) tiene la suya y hereda estas columnas.
// La clave primaria es user_id: cada perfil es 1:1 con un usuario.
export abstract class BaseProfile {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  // Fecha de alta del perfil = fecha en que se crea
  @CreateDateColumn({ name: 'enrolled_at', type: 'timestamptz' })
  enrolledAt: Date;

  // TypeORM la rellena al guardar; en la base de datos también la actualiza
  // el trigger set_updated_at de la migración
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
