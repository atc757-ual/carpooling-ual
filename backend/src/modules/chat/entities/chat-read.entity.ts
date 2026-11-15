import { Column, Entity, PrimaryColumn } from 'typeorm';

// Tabla chat_reads: hasta cuándo ha leído un participante (el conductor o el
// pasajero) la conversación de un viaje con un pasajero (lo posterior, y del
// otro, son sus no leídos)
@Entity('chat_reads')
export class ChatRead {
  @PrimaryColumn({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  // El pasajero de la conversación
  @PrimaryColumn({ name: 'passenger_id', type: 'uuid' })
  passengerId: string;

  // Quién ha leído
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'last_read_at', type: 'timestamptz' })
  lastReadAt: Date;
}
