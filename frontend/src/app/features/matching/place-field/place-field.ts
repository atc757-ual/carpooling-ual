import { translate, TranslocoPipe } from '@jsverse/transloco';
import {
  Component,
  ElementRef,
  computed,
  DestroyRef,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { IonIcon, IonInput, ModalController } from '@ionic/angular';
import { presentOverParent } from '../../../shared/utils/modal-stack.util';
import { locateOutline, navigateCircleOutline } from 'ionicons/icons';
import { EMPTY, fromEvent, map, Subject } from 'rxjs';
import { Place, PlaceSuggestion } from '../../../core/models/place.model';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { rethrowUnlessApiError } from '../../../core/models/api-error.model';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { LocationModal, LocationModalResult } from '../location-modal/location-modal';
import { Combobox, ComboboxState } from '../../../shared/components/ui/combobox/combobox';
import { PlaceSearchModal } from '../place-search-modal/place-search-modal';
import { LOCATION_MESSAGES, streamSuggestions } from './place-suggestions.util';

const UNAVAILABLE_KEY = 'screens.placeField.unavailable';
// Escritorio: el campo con su lista debajo; por debajo, la búsqueda a
// pantalla completa (el punto de corte md de theme/_breakpoints.scss)
const DESKTOP_QUERY = '(min-width: 768px)';
// Donde empieza el pin de «Elegir en el mapa» sin dirección: el centro de
// Almería
const ALMERIA_CENTER: [number, number] = [-2.4637, 36.8381];

// Una dirección de la API como lugar elegido (también al añadir una parada en
// el mapa)
export function toSearchPlace(place: Place): SearchPlace {
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
  imports: [IonIcon, IonInput, Combobox, TranslocoPipe],
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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

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
  // Para el campo (appCombobox): elegir la dirección con el teclado
  readonly combobox = new ComboboxState(
    () => this.suggestions().length,
    (index) => void this.handleSelect(this.suggestions()[index]),
  );
  readonly selected = signal<SearchPlace | null>(null);
  // Rellenada sola con la ubicación del momento (fillQuietly)
  readonly isFromLocation = signal(false);
  // Bajo el campo: lo que se está haciendo («Buscando tu ubicación…»)…
  readonly status = signal<string | null>(null);
  // …o un aviso: sin cobertura, sin permiso o el servicio caído
  readonly message = signal<string | null>(null);
  readonly isDisabled = signal(false);
  private readonly desktopQuery = globalThis.matchMedia?.(DESKTOP_QUERY);
  readonly isMobile = toSignal(
    this.desktopQuery
      ? fromEvent<MediaQueryListEvent>(this.desktopQuery, 'change').pipe(
          map(({ matches }) => !matches),
        )
      : EMPTY,
    { initialValue: this.desktopQuery ? !this.desktopQuery.matches : false },
  );
  // En rojo solo si no hay ya un aviso (p. ej. el de cobertura: uno basta), ni
  // se está buscando algo (al pulsar la mira, el campo pierde el foco y se
  // marcaría en rojo un instante antes de rellenarse), ni hay sugerencias a la
  // vista (se está eligiendo)
  readonly hasError = computed(
    () => this.showError() && !this.message() && !this.status() && this.suggestions().length === 0,
  );

  protected readonly locateIcon = locateOutline;
  protected readonly locatedIcon = navigateCircleOutline;

  private readonly queries = new Subject<string>();
  private onChange: (value: SearchPlace | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    streamSuggestions(this.queries, this.places, () => this.message.set(translate(UNAVAILABLE_KEY)))
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
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
    this.isFromLocation.set(false);
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
    await this.resolve(translate('screens.placeField.comprobandoDireccion'), async () =>
      this.applyPlace(await this.places.getPlace(suggestion.id)),
    );
  }

  // «Usar mi ubicación»: con el permiso ya dado, la busca y rellena el campo
  // sin más; si no, primero la ventana que explica para qué y lo pide
  async handleUseLocation(): Promise<void> {
    this.message.set(null);
    this.status.set(translate('screens.placeField.buscandoUbicacion'));
    let point: [number, number] | null;
    if ((await this.location.checkPermission()) === 'granted') {
      point = await this.resolve(translate('screens.placeField.buscandoUbicacion'), () =>
        this.location.getCurrentPoint(),
      );
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
    if (selected) {
      await this.pickOnMap(selected.coordinates);
    }
  }

  // En el móvil, tocar el campo abre la búsqueda a pantalla completa
  // (PlaceSearchModal); lo que se elige allí se resuelve aquí, como en el
  // escritorio
  async handleOpenSearch(): Promise<void> {
    if (!this.isMobile() || this.isDisabled()) {
      return;
    }
    // Hoja de media altura (se sube a pantalla completa arrastrándola)
    const modal = await this.modalController.create({
      component: PlaceSearchModal,
      breakpoints: [0, 0.6, 1],
      initialBreakpoint: 0.6,
      handle: true,
      componentProps: {
        title: this.label(),
        placeholder: this.placeholder(),
        canLocate: this.canLocate(),
        initialText: this.text(),
      },
    });
    await presentOverParent(modal, this.host.nativeElement);
    const { data, role } = await modal.onDidDismiss<PlaceSuggestion | Place | null>();
    this.onTouched();
    if (role === 'suggestion' && data) {
      await this.handleSelect(data as PlaceSuggestion);
    } else if (role === 'place' && data) {
      // La ubicación del momento, ya confirmada en la ventana
      this.message.set(null);
      this.applyPlace(data as Place);
      this.isFromLocation.set(this.selected() !== null);
    } else if (role === 'clear') {
      this.handleInput('');
    } else if (role === 'locate') {
      await this.handleUseLocation();
    } else if (role === 'map') {
      await this.pickOnMap(this.selected()?.coordinates ?? ALMERIA_CENTER);
    }
  }

  // El pin en ese punto, para moverlo; «Usar esta dirección» la aplica
  private async pickOnMap(point: [number, number]): Promise<void> {
    const { data, role } = await this.openLocationModal({ adjustPoint: point });
    if (role === 'select' && data && !Array.isArray(data)) {
      this.message.set(null);
      this.applyPlace(data);
    }
  }

  // Al abrir Buscar con el permiso ya dado: la dirección de ese punto, sin
  // avisos (si cae fuera de la zona de servicio o falla, el campo se queda
  // vacío). Debajo se ve «Desde tu ubicación actual»
  async fillQuietly(point: [number, number]): Promise<void> {
    try {
      const place = await this.places.reverse(point);
      if (place.isCovered && !this.selected() && this.text() === '') {
        this.applyPlace(place);
        this.isFromLocation.set(true);
      }
    } catch (error) {
      // Sin dirección (la API no la encuentra o no responde): se escribe a mano
      rethrowUnlessApiError(error);
    }
  }

  // La dirección que ya tiene el campo es la de la ubicación del momento
  markFromLocation(): void {
    if (this.selected()) {
      this.isFromLocation.set(true);
    }
  }

  private async fillFromPoint(point: [number, number]): Promise<void> {
    this.suggestions.set([]);
    await this.resolve(translate('screens.placeField.buscandoDireccion'), async () =>
      this.applyPlace(await this.places.reverse(point)),
    );
    // El botón pasa a «Usando tu ubicación actual» (si la dirección valió)
    this.isFromLocation.set(this.selected() !== null);
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
    await presentOverParent(modal, this.host.nativeElement);
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
        error instanceof LocationError
          ? LOCATION_MESSAGES[error.reason]
          : translate(UNAVAILABLE_KEY),
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
        translate('screens.placeField.aunLlegamosEsperamosTener', {
          municipality: place.municipality,
        }),
      );
    }
  }
}
