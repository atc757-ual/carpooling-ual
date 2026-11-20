import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { CoPassenger, ParticipantProfile } from '../../models/participant-profile.model';

// Con quién se viaja: el perfil del conductor o de un pasajero con plaza, para
// la otra parte del viaje. Lanza ApiError (403 si no se comparte el viaje)
@Injectable({ providedIn: 'root' })
export class TripParticipantsService {
  private readonly http = inject(HttpClient);

  async getProfile(tripId: string, userId: string): Promise<ParticipantProfile> {
    try {
      return await firstValueFrom(
        this.http.get<ParticipantProfile>(
          `${environment.apiUrl}/trips/${tripId}/participants/${userId}`,
        ),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }

  // Los compañeros de viaje del pasajero con plaza (como mucho las plazas del
  // coche: cabe en la primera página)
  async listCoPassengers(tripId: string): Promise<CoPassenger[]> {
    try {
      return await firstValueFrom(
        this.http.get<CoPassenger[]>(`${environment.apiUrl}/trips/${tripId}/participants`),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
