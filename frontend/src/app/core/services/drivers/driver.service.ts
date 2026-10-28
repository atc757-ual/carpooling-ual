import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import {
  DriverStatus,
  DriverTrip,
  PublishedTrip,
  PublishTripRequest,
  RegisterVehicleRequest,
  UpdateVehicleRequest,
  Vehicle,
} from '../../models/driver.model';
import { SeatRequest } from '../../models/seat-request.model';

// Como mucho una página: un conductor tiene pocos viajes a la vez
const MY_TRIPS_LIMIT = 100;

// Lo que hace el conductor: su estado (declaración y vehículos), sus
// vehículos, publicar viajes y, en Mis viajes, verlos con sus solicitudes y
// decidirlas. Los métodos lanzan ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class DriverService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getStatus(): Promise<DriverStatus> {
    return this.request(this.http.get<DriverStatus>(`${this.apiUrl}/users/me/driver-status`));
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

  // Dar de baja (deja de salir; registrar otra vez la matrícula la recupera).
  // Con un viaje pendiente o en curso, VEHICLE_IN_USE
  async deactivateVehicle(vehicleId: string): Promise<void> {
    await this.request(this.http.delete<void>(`${this.apiUrl}/vehicles/${vehicleId}`));
  }

  // Declaración responsable (RF-21); se puede repetir sin efecto
  acceptDeclaration(): Promise<DriverStatus> {
    return this.request(
      this.http.put<DriverStatus>(`${this.apiUrl}/users/me/driver-declaration`, null),
    );
  }

  // Mis viajes como conductor, del más próximo al más lejano
  listMyTrips(): Promise<DriverTrip[]> {
    return this.request(
      this.http.get<DriverTrip[]>(`${this.apiUrl}/users/me/trips`, {
        params: { limit: MY_TRIPS_LIMIT },
      }),
    );
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

  publishTrip(trip: PublishTripRequest): Promise<PublishedTrip> {
    return this.request(this.http.post<PublishedTrip>(`${this.apiUrl}/trips`, trip));
  }

  private async request<T>(response: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(response);
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
