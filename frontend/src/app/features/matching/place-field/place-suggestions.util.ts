import {
  catchError,
  debounceTime,
  distinctUntilChanged,
  map,
  Observable,
  of,
  switchMap,
} from 'rxjs';
import { PlaceSuggestion } from '../../../core/models/place.model';
import { PlacesService } from '../../../core/services/places/places.service';
import { LocationError } from '../../../core/services/location/location.service';
import { lazyLabels } from '../../../core/i18n/lazy-labels';

// Letras a partir de las que se sugieren direcciones, y la espera tras la
// última tecla (para no pedir una búsqueda por letra)
const MIN_LETTERS = 3;
const DEBOUNCE_MS = 300;

// Las sugerencias de lo que se va escribiendo: a partir de 3 letras y tras
// 300 ms sin teclear. Si el servicio falla, ninguna y el aviso
// (onUnavailable). La usan el campo (PlaceField) y, en el móvil, la ventana
// de búsqueda (PlaceSearchModal)
export function streamSuggestions(
  queries: Observable<string>,
  places: PlacesService,
  onUnavailable: () => void,
): Observable<readonly PlaceSuggestion[]> {
  return queries.pipe(
    debounceTime(DEBOUNCE_MS),
    map((text) => text.trim()),
    distinctUntilChanged(),
    switchMap((text) =>
      text.length < MIN_LETTERS
        ? of([])
        : places.suggest(text).pipe(
            catchError(() => {
              onUnavailable();
              return of([]);
            }),
          ),
    ),
  );
}

// Por qué no se pudo usar la ubicación (el campo y la ventana de búsqueda)
export const LOCATION_MESSAGES: Readonly<Record<LocationError['reason'], string>> = lazyLabels({
  denied: 'screens.placeField.locationDenied',
  unavailable: 'screens.placeField.locationUnavailable',
  revoked: 'screens.placeField.locationRevoked',
});
