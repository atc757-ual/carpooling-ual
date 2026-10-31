import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { RegistrableProfile } from '../profile-type';
import {
  CONVERSATION_PREFERENCES,
  type AvatarKey,
  type ConversationPreference,
  MUSIC_PREFERENCES,
  type MusicPreference,
  PETS_PREFERENCES,
  type PetsPreference,
  SMOKING_PREFERENCES,
  type SmokingPreference,
} from '../travel-preferences';
import { AdminProfile } from './admin-profile.entity';
import { DriverProfile } from './driver-profile.entity';
import { PassengerProfile } from './passenger-profile.entity';

// Tabla users: datos de la cuenta. Los roles no son subclases de User sino
// perfiles 1:1 (un mismo usuario puede ser conductor y pasajero), como en el
// modelo de dominio de la memoria.
@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  // citext: la base de datos compara sin distinguir mayúsculas, así que
  // Ana@UAL.es y ana@ual.es son el mismo correo
  @Column({ type: 'citext', unique: true })
  email: string;

  // select: false → el hash NO se carga en las consultas normales; solo cuando
  // se pide explícitamente (en el login). Así es imposible devolverlo por error
  @Column({ name: 'password_hash', type: 'text', select: false })
  passwordHash: string;

  // Formato internacional E.164 (+34600123456). NULL solo en el administrador
  // inicial y el seed: el registro público lo exige
  @Column({ type: 'varchar', length: 16, nullable: true })
  phone: string | null;

  // Prueba del consentimiento (RGPD): cuándo aceptó las normas y la política
  // de privacidad al registrarse. NULL en quien no pasó por el registro
  @Column({ name: 'terms_accepted_at', type: 'timestamptz', nullable: true })
  termsAcceptedAt: Date | null;

  // Cuándo verificó el correo con el código; solo los verificados pueden
  // iniciar sesión. El administrador inicial se crea ya verificado
  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt: Date | null;

  @Column({ name: 'time_tolerance_min', type: 'smallint', default: 15 })
  timeToleranceMin: number;

  // Modo con el que viaja ahora (el mismo en todos sus dispositivos). NULL
  // hasta que lo elige: el cliente usa su modo por defecto
  @Column({ name: 'active_mode', type: 'varchar', length: 10, nullable: true })
  activeMode: RegistrableProfile | null;

  // Clave del catálogo cerrado de avatares (tabla avatars); NULL muestra las
  // iniciales del nombre
  @Column({
    name: 'avatar_key',
    type: 'varchar',
    length: 30,
    nullable: true,
    default: null,
  })
  avatarKey: AvatarKey | null = null;

  // «Sobre mí» público, de 20 a 500 caracteres cuando se rellena
  @Column({ type: 'varchar', length: 500, nullable: true, default: null })
  bio: string | null = null;

  @Column({
    name: 'pref_conversation',
    type: 'enum',
    enum: CONVERSATION_PREFERENCES,
    enumName: 'conversation_preference',
    nullable: true,
    default: null,
  })
  conversationPreference: ConversationPreference | null = null;

  @Column({
    name: 'pref_music',
    type: 'enum',
    enum: MUSIC_PREFERENCES,
    enumName: 'music_preference',
    nullable: true,
    default: null,
  })
  musicPreference: MusicPreference | null = null;

  @Column({
    name: 'pref_smoking',
    type: 'enum',
    enum: SMOKING_PREFERENCES,
    enumName: 'smoking_preference',
    nullable: true,
    default: null,
  })
  smokingPreference: SmokingPreference | null = null;

  @Column({
    name: 'pref_pets',
    type: 'enum',
    enum: PETS_PREFERENCES,
    enumName: 'pets_preference',
    nullable: true,
    default: null,
  })
  petsPreference: PetsPreference | null = null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Lados inversos de las relaciones 1:1 (la columna user_id está en cada perfil).
  // Relation<> evita problemas de importación circular entre User y los perfiles
  @OneToOne(() => DriverProfile, (profile) => profile.user)
  driverProfile?: Relation<DriverProfile> | null;

  @OneToOne(() => PassengerProfile, (profile) => profile.user)
  passengerProfile?: Relation<PassengerProfile> | null;

  @OneToOne(() => AdminProfile, (profile) => profile.user)
  adminProfile?: Relation<AdminProfile> | null;
}
