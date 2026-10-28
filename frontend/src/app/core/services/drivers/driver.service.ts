import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import {
  DriverStatus,
  PublishedTrip,
  PublishTripRequest,
  RegisterVehicleRequest,
  UpdateVehicleRequest,
  Vehicle,
} from '../../models/driver.model';

// Lo que necesita el conductor para publicar: su estado (declaración y
// vehículos), sus vehículos y la publicación del viaje. Los métodos lanzan
// ApiError (ver shared/utils/error-message.util.ts)
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

  // Declaración responsable (RF-21); se puede repetir sin efecto
  acceptDeclaration(): Promise<DriverStatus> {
    return this.request(
      this.http.put<DriverStatus>(`${this.apiUrl}/users/me/driver-declaration`, null),
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
