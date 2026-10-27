import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { CampusParking, Place, PlaceSuggestion } from '../../models/place.model';

// Cuántas sugerencias se piden mientras se escribe
const SUGGESTION_LIMIT = 5;

// Lugares: los parkings del campus (se piden una vez y se comparten) y la
// búsqueda de direcciones (CartoCiudad, a través de la API). Los métodos
// lanzan ApiError (ver shared/utils/error-message.util.ts)
@Injectable({ providedIn: 'root' })
export class PlacesService {
  private readonly http = inject(HttpClient);
  private readonly placesUrl = `${environment.apiUrl}/places`;

  private readonly parkingList = signal<readonly CampusParking[]>([]);
  // Vacía hasta que llegan (o si fallan: se reintenta al volver a pedirlos)
  readonly parkings = this.parkingList.asReadonly();
  private parkingsRequest: Promise<void> | null = null;

  // Pide los parkings la primera vez; las siguientes, nada
  loadParkings(): Promise<void> {
    this.parkingsRequest ??= firstValueFrom(
      this.http.get<CampusParking[]>(`${environment.apiUrl}/campus-parkings`),
    ).then(
      (parkings) => this.parkingList.set(parkings),
      () => {
        this.parkingsRequest = null;
      },
    );
    return this.parkingsRequest;
  }

  // Direcciones que encajan con el texto (de 3 letras en adelante)
  suggest(text: string): Observable<PlaceSuggestion[]> {
    return this.http.get<PlaceSuggestion[]>(this.placesUrl, {
      params: { q: text, limit: SUGGESTION_LIMIT },
    });
  }

  // La dirección de una sugerencia, con su punto y si hay cobertura
  getPlace(id: string): Promise<Place> {
    return firstValueFrom(this.http.get<Place>(`${this.placesUrl}/${id}`));
  }
}
