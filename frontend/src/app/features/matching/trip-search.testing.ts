import { signal } from '@angular/core';
import { SearchParking, SearchPlace } from '../../core/models/trip-search.model';

// Datos de prueba de las búsquedas (solo para los tests)

export const ROQUETAS: SearchPlace = {
  id: 'roquetas',
  name: 'Roquetas de Mar',
  locality: 'Roquetas de Mar',
  coordinates: [-2.6146, 36.7642],
};

export const PARKING_P1: SearchParking = { id: 'p1', name: 'Parking P1' };
export const PARKING_P3: SearchParking = { id: 'p3', name: 'Parking P3' };

// jsdom no tiene IntersectionObserver y el selector de fecha de Ionic lo usa
// al cargarse (en los tests que pintan el formulario de búsqueda)
export function stubIntersectionObserver(): void {
  globalThis.IntersectionObserver ??= class {
    observe(): void {
      // En los tests no se observa nada
    }
    unobserve(): void {
      // Nada que dejar de observar
    }
    disconnect(): void {
      // Nada que desconectar
    }
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

// PlacesService sin red, con P1 y P3, para los tests que pintan el formulario
// (sin él, whenStable esperaría a la petición de los parkings)
export const PLACES_SERVICE_STUB = {
  parkings: signal(
    [PARKING_P1, PARKING_P3].map(({ id, name }) => ({
      id,
      name,
      location: { type: 'Point' as const, coordinates: [-2.4, 36.83] as [number, number] },
    })),
  ),
  loadParkings: (): Promise<void> => Promise.resolve(),
};
