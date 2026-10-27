import { Component, DestroyRef, forwardRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IonIcon, IonInput, ModalController } from '@ionic/angular';
import { locateOutline } from 'ionicons/icons';
import { catchError, debounceTime, distinctUntilChanged, map, of, Subject, switchMap } from 'rxjs';
import { Place, PlaceSuggestion } from '../../../core/models/place.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { PlacesService } from '../../../core/services/places/places.service';
import { LocationModal } from '../location-modal/location-modal';

// Letras a partir de las que se sugieren direcciones, y la espera tras la
// última tecla (para no pedir una búsqueda por letra)
const MIN_LETTERS = 3;
const DEBOUNCE_MS = 300;
const UNAVAILABLE_MESSAGE =
  'Ahora no podemos buscar direcciones. Inténtalo de nuevo en un momento.';

function toSearchPlace(place: Place): SearchPlace {
  return {
    id: place.id,
    name: place.name,
    locality: place.locality,
    coordinates: place.location.coordinates,
  };
}

// Campo de dirección (origen al ir, destino al volver) para formularios
// reactivos: mientras se escribe sugiere direcciones de la provincia
// (CartoCiudad, con su atribución) y su valor es la dirección ELEGIDA, con su
// punto, o null mientras no se elige una. Fuera de la zona de servicio no se
// puede elegir: «Aún no llegamos a Vera…». Con el botón de la ubicación,
// la dirección sale del mapa (LocationModal)
@Component({
  selector: 'app-place-field',
  imports: [IonIcon, IonInput],
  templateUrl: './place-field.html',
  styleUrl: './place-field.scss',
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => PlaceField), multi: true },
  ],
})
export class PlaceField implements ControlValueAccessor {
  private readonly places = inject(PlacesService);
  private readonly modalController = inject(ModalController);

  // «Origen» o «Destino» (nombre del campo para los lectores de pantalla)
  readonly label = input.required<string>();
  readonly placeholder = input.required<string>();
  readonly icon = input.required<string>();
  // En rojo, con «Elige una dirección de la lista.» (lo decide el formulario)
  readonly showError = input(false);

  readonly text = signal('');
  readonly suggestions = signal<readonly PlaceSuggestion[]>([]);
  // Aviso bajo el campo: sin cobertura o el servicio caído
  readonly message = signal<string | null>(null);
  readonly isResolving = signal(false);
  readonly isDisabled = signal(false);

  protected readonly locateIcon = locateOutline;

  private readonly queries = new Subject<string>();
  private selected: SearchPlace | null = null;
  private onChange: (value: SearchPlace | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    this.queries
      .pipe(
        debounceTime(DEBOUNCE_MS),
        map((text) => text.trim()),
        distinctUntilChanged(),
        switchMap((text) =>
          text.length < MIN_LETTERS
            ? of([])
            : this.places.suggest(text).pipe(
                catchError(() => {
                  this.message.set(UNAVAILABLE_MESSAGE);
                  return of([]);
                }),
              ),
        ),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((suggestions) => this.suggestions.set(suggestions));
  }

  writeValue(place: SearchPlace | null): void {
    this.selected = place;
    this.text.set(place?.name ?? '');
    this.message.set(null);
    this.suggestions.set([]);
  }

  registerOnChange(onChange: (value: SearchPlace | null) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
  }

  // Al escribir, la dirección elegida deja de valer hasta elegir otra
  handleInput(text: string): void {
    this.text.set(text);
    this.message.set(null);
    if (this.selected) {
      this.selected = null;
      this.onChange(null);
    }
    this.queries.next(text);
  }

  handleBlur(): void {
    this.onTouched();
  }

  // La dirección con su punto: dentro de la zona, es el valor del campo; fuera,
  // el aviso de cobertura
  async handleSelect(suggestion: PlaceSuggestion): Promise<void> {
    this.suggestions.set([]);
    this.queries.next('');
    this.text.set(suggestion.name);
    this.isResolving.set(true);
    try {
      this.applyPlace(await this.places.getPlace(suggestion.id));
    } catch {
      this.message.set(UNAVAILABLE_MESSAGE);
    } finally {
      this.isResolving.set(false);
      this.onTouched();
    }
  }

  // «Usar mi ubicación»: el modal con el mapa devuelve la dirección elegida
  // (siempre dentro de la zona), o nada si se cierra
  async handleUseLocation(): Promise<void> {
    const modal = await this.modalController.create({ component: LocationModal });
    await modal.present();
    const { data, role } = await modal.onDidDismiss<Place>();
    if (role === 'select' && data) {
      this.suggestions.set([]);
      this.message.set(null);
      this.applyPlace(data);
      this.onTouched();
    }
  }

  private applyPlace(place: Place): void {
    this.text.set(place.name);
    if (place.isCovered) {
      this.selected = toSearchPlace(place);
      this.onChange(this.selected);
    } else {
      this.message.set(
        `Aún no llegamos a ${place.municipality}. Esperamos tener cobertura allí pronto.`,
      );
    }
  }
}
