// Solicitud de plaza (recurso SeatRequest de la API). El backend decide el
// estado; la interfaz solo lo refleja (guía, «Solicitud de plaza»)
import { TravelPreferences } from './travel-preferences.model';

export type SeatRequestStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';

export interface SeatRequest {
  id: string;
  trip: { id: string };
  // Quién la pide (lo ve el conductor)
  passenger: {
    id: string;
    name: string;
    avatarKey?: string | null;
    preferences?: TravelPreferences;
  };
  status: SeatRequestStatus;
  // RF-24: afectado por la cancelación de un viaje en curso (va primero)
  isPriority: boolean;
  // Plazas para el pasajero y sus compañeros (1-4)
  seats: number;
  direction?: 'to-campus' | 'from-campus' | null;
  pickupLocation?: { type: 'Point'; coordinates: [number, number] } | null;
  pickupName?: string | null;
  pickupAt?: string | null;
  requestedAt: string;
  answeredAt: string | null;
  cancelledAt: string | null;
  // La matrícula, solo con la solicitud aceptada
  vehiclePlate: string | null;
}
