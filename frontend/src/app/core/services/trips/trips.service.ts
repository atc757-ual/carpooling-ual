import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiError } from '../../models/api-error.model';
import { Trip } from '../../models/driver.model';
import { TripRoute } from '../../models/trip-route.model';

// Viajes vistos por cualquier usuario (p. ej. el de cada solicitud del
// pasajero). Lanza ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class TripsService {
  private readonly http = inject(HttpClient);

  async getTrip(tripId: string): Promise<Trip> {
    try {
      return await firstValueFrom(this.http.get<Trip>(`${environment.apiUrl}/trips/${tripId}`));
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }

  async getRoute(tripId: string): Promise<TripRoute> {
    try {
      return await firstValueFrom(
        this.http.get<TripRoute>(`${environment.apiUrl}/trips/${tripId}/route`),
      );
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }

  // Con paradas (via), la ruta pasa por ellas en el orden de la ruta
  async planRoute(
    origin: [number, number],
    destination: [number, number],
    via: readonly [number, number][] = [],
  ): Promise<TripRoute> {
    try {
      const response = await firstValueFrom(
        this.http.post<{
          distanceKm: number;
          durationMin: number;
          geometry: { type: 'LineString'; coordinates: [number, number][] };
          source: 'osrm' | 'estimated';
        }>(`${environment.apiUrl}/trips/plan`, {
          origin: { type: 'Point', coordinates: origin },
          destination: { type: 'Point', coordinates: destination },
          ...(via.length > 0 && {
            via: via.map((coordinates) => ({ type: 'Point', coordinates })),
          }),
        }),
      );
      return {
        tripId: 'preview',
        distanceKm: response.distanceKm,
        durationMin: response.durationMin,
        geometry: response.geometry,
        source: response.source,
        tripStatus: 'published',
        startedAt: null,
        estimatedArrivalAt: null,
      };
    } catch (error) {
      throw ApiError.fromHttpError(error);
    }
  }
}
