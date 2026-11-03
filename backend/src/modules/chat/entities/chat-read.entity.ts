import { Column, Entity, PrimaryColumn } from 'typeorm';

// Tabla chat_reads: hasta cuándo ha leído un participante el chat de un
// viaje (lo posterior, y de otros, son sus no leídos)
@Entity('chat_reads')
export class ChatRead {
  @PrimaryColumn({ name: 'trip_id', type: 'uuid' })
  tripId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'last_read_at', type: 'timestamptz' })
  lastReadAt: Date;
}
