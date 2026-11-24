import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { AuthService } from '../auth/auth.service';
import {
  DriverStatus,
  DriverTrip,
  PublishingStatus,
  PublishedTrip,
  PublishTripRequest,
  RegisterVehicleRequest,
  Trip,
  UpdateVehicleRequest,
  Vehicle,
} from '../../models/driver.model';
import { GeoPoint } from '../../models/place.model';
import { SeatRequest } from '../../models/seat-request.model';

// Lo que hace el conductor: su estado (declaración y vehículos), sus
// vehículos, publicar viajes y, en Mis viajes, verlos con sus solicitudes y
// decidirlas. Los métodos lanzan ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class DriverService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly apiUrl = environment.apiUrl;

  getStatus(): Promise<DriverStatus> {
    return this.request(this.http.get<DriverStatus>(`${this.apiUrl}/users/me/driver-status`));
  }

  getPublishingStatus(): Promise<PublishingStatus> {
    return this.request(
      this.http.get<PublishingStatus>(`${this.apiUrl}/users/me/publishing-status`),
    );
  }

  listVehicles(): Promise<Vehicle[]> {
    return this.request(this.http.get<Vehicle[]>(`${this.apiUrl}/vehicles`));
  }

  registerVehicle(vehicle: RegisterVehicleRequest): Promise<Vehicle> {
    return this.request(this.http.post<Vehicle>(`${this.apiUrl}/vehicles`, vehicle));
  }

  updateVehicle(vehicleId: string, changes: UpdateVehicleRequest): Promise<Vehicle> {
    return this.request(this.http.patch<Vehicle>(`${this.apiUrl}/vehicles/${vehicleId}`, changes));
  }

  // La declaración vigente (seguro e ITV) de uno de sus vehículos: tras un
  // cambio importante de su texto, antes de volver a publicar con él
  acceptVehicleDeclaration(vehicleId: string): Promise<Vehicle> {
    return this.request(
      this.http.put<Vehicle>(`${this.apiUrl}/vehicles/${vehicleId}/declaration`, {}),
    );
  }

  // Dar de baja (deja de salir; registrar otra vez la matrícula la recupera).
  // Con un viaje en curso, VEHICLE_IN_USE; con viajes programados,
  // VEHICLE_HAS_UPCOMING_TRIPS (antes se pasan a otro coche o se cancelan)
  async deactivateVehicle(vehicleId: string): Promise<void> {
    await this.request(this.http.delete<void>(`${this.apiUrl}/vehicles/${vehicleId}`));
  }

  // Los viajes publicados o confirmados de un coche, del más próximo al último
  listVehicleUpcomingTrips(vehicleId: string): Promise<DriverTrip[]> {
    return this.request(
      this.http.get<DriverTrip[]>(`${this.apiUrl}/vehicles/${vehicleId}/upcoming-trips`, {
        params: { limit: 100 },
      }),
    );
  }

  // Pasa esos viajes a otro coche suyo, todos o ninguno; sus pasajeros
  // aceptados reciben el aviso
  changeTripsVehicle(tripIds: readonly string[], vehicleId: string): Promise<DriverTrip[]> {
    return this.request(
      this.http.post<DriverTrip[]>(`${this.apiUrl}/trips/vehicle-changes`, {
        tripIds,
        vehicleId,
      }),
    );
  }

  // Declaración responsable (RF-21); se puede repetir sin efecto
  acceptDeclaration(): Promise<DriverStatus> {
    return this.request(
      this.http.put<DriverStatus>(`${this.apiUrl}/users/me/driver-declaration`, null),
    );
  }

  // Uno de mis viajes por su id. Si no lo conduce el usuario, como si no
  // existiera (TRIP_NOT_FOUND): las pantallas del conductor son solo suyas
  async getMyTrip(tripId: string): Promise<Trip> {
    const trip = await this.request(this.http.get<Trip>(`${this.apiUrl}/trips/${tripId}`));
    if (trip.driver.id !== this.auth.currentUser()?.id) {
      throw new ApiError('TRIP_NOT_FOUND', 404);
    }
    return trip;
  }

  // Las solicitudes de uno de mis viajes (las prioritarias primero)
  listTripRequests(tripId: string): Promise<SeatRequest[]> {
    return this.request(this.http.get<SeatRequest[]>(`${this.apiUrl}/trips/${tripId}/requests`));
  }

  // RF-09: aceptar (resta sus plazas) o rechazar una solicitud
  decideRequest(requestId: string, decision: 'accept' | 'reject'): Promise<SeatRequest> {
    return this.request(
      this.http.post<SeatRequest>(`${this.apiUrl}/requests/${requestId}/${decision}`, null),
    );
  }

  // Validar subida del pasajero con su código de recogida de 4 cifras
  boardPassenger(requestId: string, code: string): Promise<SeatRequest> {
    return this.request(
      this.http.post<SeatRequest>(`${this.apiUrl}/requests/${requestId}/board`, { code }),
    );
  }

  // «Ha bajado»: cierra la plaza de un pasajero a bordo; al bajarse el
  // último, el viaje termina solo
  dropOffPassenger(requestId: string): Promise<SeatRequest> {
    return this.request(
      this.http.post<SeatRequest>(`${this.apiUrl}/requests/${requestId}/drop-off`, null),
    );
  }

  // Marcar «No se presentó» tras esperar 5 minutos de cortesía
  markNoShow(requestId: string): Promise<SeatRequest> {
    return this.request(
      this.http.post<SeatRequest>(`${this.apiUrl}/requests/${requestId}/no-show`, null),
    );
  }

  publishTrip(trip: PublishTripRequest): Promise<PublishedTrip> {
    return this.request(this.http.post<PublishedTrip>(`${this.apiUrl}/trips`, trip));
  }

  cancelTrip(tripId: string): Promise<DriverTrip> {
    return this.request(this.http.post<DriverTrip>(`${this.apiUrl}/trips/${tripId}/cancel`, null));
  }

  // RF-11: desde START_WINDOW_MIN (10 min) antes de la salida
  startTrip(tripId: string): Promise<DriverTrip> {
    return this.request(this.http.post<DriverTrip>(`${this.apiUrl}/trips/${tripId}/start`, null));
  }

  // Con su posición, si se sabe: la API guarda a cuántos metros del destino
  finishTrip(tripId: string, coordinates: [number, number] | null = null): Promise<DriverTrip> {
    const body = coordinates ? { position: { type: 'Point', coordinates } } : null;
    return this.request(this.http.post<DriverTrip>(`${this.apiUrl}/trips/${tripId}/finish`, body));
  }

  // Dónde está ahora el conductor ([longitud, latitud]); la hora la pone el servidor
  async reportPosition(tripId: string, coordinates: [number, number]): Promise<void> {
    const position: GeoPoint = { type: 'Point', coordinates };
    await this.request(
      this.http.post<void>(`${this.apiUrl}/trips/${tripId}/positions`, { position }),
    );
  }

  private async request<T>(response: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(response);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
