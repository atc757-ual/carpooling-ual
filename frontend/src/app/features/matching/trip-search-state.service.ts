import { Injectable, signal } from '@angular/core';
import { TripSearch } from '../../core/models/trip-search.model';
import { parseTripSearch } from './trip-search';

const STORAGE_KEY = 'matching.trip-search';

// La búsqueda guardada al recargar la página, si la hay y vale. sessionStorage
// puede no estar disponible (modo privado, almacenamiento bloqueado): entonces
// se empieza sin búsqueda
function readStoredSearch(): TripSearch | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    return stored ? parseTripSearch(JSON.parse(stored)) : null;
  } catch {
    return null;
  }
}

function writeStoredSearch(search: TripSearch | null): void {
  try {
    if (search) {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(search));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Sin almacenamiento, la búsqueda dura hasta recargar
  }
}

// La última búsqueda de viajes, compartida por Inicio (su formulario sale
// relleno con ella) y Buscar (su resumen y sus resultados). No va en la URL:
// el lugar puede ser una dirección personal y quedaría en el historial y en
// los logs del servidor. Se guarda en sessionStorage (solo esta pestaña del
// navegador, se borra al cerrarla) para no perderla al recargar
@Injectable({ providedIn: 'root' })
export class TripSearchStateService {
  private readonly current = signal<TripSearch | null>(readStoredSearch());

  readonly search = this.current.asReadonly();

  set(search: TripSearch): void {
    this.current.set(search);
    writeStoredSearch(search);
  }

  // Nueva búsqueda: se vuelve al formulario vacío
  clear(): void {
    this.current.set(null);
    writeStoredSearch(null);
  }
}
