import { Component, computed, DestroyRef, forwardRef, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IonIcon, IonInput, ModalController } from '@ionic/angular';
import { locateOutline } from 'ionicons/icons';
import { catchError, debounceTime, distinctUntilChanged, map, of, Subject, switchMap } from 'rxjs';
import { Place, PlaceSuggestion } from '../../../core/models/place.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { LocationModal, LocationModalResult } from '../location-modal/location-modal';

// Letras a partir de las que se sugieren direcciones, y la espera tras la
// última tecla (para no pedir una búsqueda por letra)
const MIN_LETTERS = 3;
const DEBOUNCE_MS = 300;
const UNAVAILABLE_MESSAGE =
  'Ahora no podemos buscar direcciones. Inténtalo de nuevo en un momento.';
const LOCATION_MESSAGES: Readonly<Record<LocationError['reason'], string>> = {
  denied:
    'No tenemos permiso para ver tu ubicación. Actívalo en los ajustes o escribe la dirección.',
  unavailable: 'No hemos podido saber dónde estás. Inténtalo de nuevo o escribe la dirección.',
};

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
// puede elegir: «Aún no llegamos a Vera…». En el origen (canLocate), además:
// «Usar mi ubicación» rellena la dirección con la del dispositivo (la primera
// vez, con una ventana que explica para qué y pide el permiso) y, con una
// dirección elegida (en los dos), «Ajustar en el mapa» (LocationModal)
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
  private readonly location = inject(LocationService);
  private readonly modalController = inject(ModalController);

  // «Origen» o «Destino» (nombre del campo para los lectores de pantalla)
  readonly label = input.required<string>();
  readonly placeholder = input.required<string>();
  readonly icon = input.required<string>();
  // Con «Usar mi ubicación»: solo en el origen (al volver del campus, la
  // ubicación del momento no es el destino)
  readonly canLocate = input(false);
  // En rojo, con «Elige una dirección de la lista.» (lo decide el formulario)
  readonly showError = input(false);

  readonly text = signal('');
  readonly suggestions = signal<readonly PlaceSuggestion[]>([]);
  readonly selected = signal<SearchPlace | null>(null);
  // Bajo el campo: lo que se está haciendo («Buscando tu ubicación…»)…
  readonly status = signal<string | null>(null);
  // …o un aviso: sin cobertura, sin permiso o el servicio caído
  readonly message = signal<string | null>(null);
  readonly isDisabled = signal(false);
  // En rojo solo si no hay ya un aviso (p. ej. el de cobertura: uno basta), ni
  // se está buscando algo (al pulsar la mira, el campo pierde el foco y se
  // marcaría en rojo un instante antes de rellenarse), ni hay sugerencias a la
  // vista (se está eligiendo)
  readonly hasError = computed(
    () => this.showError() && !this.message() && !this.status() && this.suggestions().length === 0,
  );

  protected readonly locateIcon = locateOutline;

  private readonly queries = new Subject<string>();
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
    this.selected.set(place);
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
    if (this.selected()) {
      this.selected.set(null);
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
    await this.resolve('Comprobando la dirección…', async () =>
      this.applyPlace(await this.places.getPlace(suggestion.id)),
    );
  }

  // «Usar mi ubicación»: con el permiso ya dado, la busca y rellena el campo
  // sin más; si no, primero la ventana que explica para qué y lo pide
  async handleUseLocation(): Promise<void> {
    this.message.set(null);
    this.status.set('Buscando tu ubicación…');
    let point: [number, number] | null;
    if ((await this.location.checkPermission()) === 'granted') {
      point = await this.resolve('Buscando tu ubicación…', () => this.location.getCurrentPoint());
    } else {
      this.status.set(null);
      const { data, role } = await this.openLocationModal({});
      point = role === 'located' && Array.isArray(data) ? data : null;
    }
    if (point) {
      await this.fillFromPoint(point);
    }
  }

  // «Ajustar en el mapa»: el pin en la dirección elegida, para moverlo
  async handleAdjust(): Promise<void> {
    const selected = this.selected();
    if (!selected) {
      return;
    }
    const { data, role } = await this.openLocationModal({ adjustPoint: selected.coordinates });
    if (role === 'select' && data && !Array.isArray(data)) {
      this.message.set(null);
      this.applyPlace(data);
    }
  }

  private async fillFromPoint(point: [number, number]): Promise<void> {
    this.suggestions.set([]);
    await this.resolve('Buscando la dirección…', async () =>
      this.applyPlace(await this.places.reverse(point)),
    );
  }

  // Tan alta como su contenido: en el móvil, pegada abajo; en escritorio,
  // centrada (ion-modal.location-dialog, en el tema)
  private async openLocationModal(
    componentProps: Partial<Pick<LocationModal, 'adjustPoint'>>,
  ): Promise<{ data?: LocationModalResult; role?: string }> {
    const modal = await this.modalController.create({
      component: LocationModal,
      componentProps,
      cssClass: 'location-dialog',
    });
    await modal.present();
    return modal.onDidDismiss<LocationModalResult>();
  }

  // Hace algo con su texto de estado debajo; si falla, el aviso que toque
  // (y null)
  private async resolve<T>(status: string, action: () => Promise<T>): Promise<T | null> {
    this.status.set(status);
    try {
      return await action();
    } catch (error) {
      this.message.set(
        error instanceof LocationError ? LOCATION_MESSAGES[error.reason] : UNAVAILABLE_MESSAGE,
      );
      return null;
    } finally {
      this.status.set(null);
      this.onTouched();
    }
  }

  private applyPlace(place: Place): void {
    this.text.set(place.name);
    if (place.isCovered) {
      this.selected.set(toSearchPlace(place));
      this.onChange(this.selected());
    } else {
      this.message.set(
        `Aún no llegamos a ${place.municipality}. Esperamos tener cobertura allí pronto.`,
      );
    }
  }
}
