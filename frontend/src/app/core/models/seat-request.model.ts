// Solicitud de plaza (recurso SeatRequest de la API). El backend decide el
// estado; la interfaz solo lo refleja (guía, «Solicitud de plaza»)
export type SeatRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface SeatRequest {
  id: string;
  trip: { id: string };
  // Quién la pide (lo ve el conductor)
  passenger: { id: string; name: string };
  status: SeatRequestStatus;
  // RF-24: afectado por la cancelación de un viaje en curso (va primero)
  isPriority: boolean;
  // Plazas para el pasajero y sus compañeros (1-4)
  seats: number;
  requestedAt: string;
  // La matrícula, solo con la solicitud aceptada
  vehiclePlate: string | null;
}
