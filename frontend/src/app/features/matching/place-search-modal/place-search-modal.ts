import { Component, DestroyRef, inject, Input, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import {
  IonContent,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSearchbar,
  ModalController,
} from '@ionic/angular';
import {
  closeCircleOutline,
  locateOutline,
  locationOutline,
  mapOutline,
  navigateCircleOutline,
} from 'ionicons/icons';
import { Subject } from 'rxjs';
import { Place, PlaceSuggestion } from '../../../core/models/place.model';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { ModalHeader } from '../../../shared/components/modals/modal-header/modal-header';
import { LOCATION_MESSAGES, streamSuggestions } from '../place-field/place-suggestions.util';

// Lo que se elige en la ventana: una sugerencia, la dirección de la ubicación
// del momento (ya confirmada), pedir el permiso de ubicación (la primera vez,
// lo explica el campo) o elegir el punto en el mapa (lo resuelve PlaceField)
export type PlaceSearchRole = 'suggestion' | 'place' | 'locate' | 'map' | 'clear';

// En el móvil, el origen o el destino se eligen en una ventana a pantalla
// completa (como en las apps de mapas): arriba se escribe, con el teclado
// abierto la lista de direcciones tiene todo el alto y, antes de escribir,
// los atajos «Usar mi ubicación» (solo en el origen) y «Elegir en el mapa».
// En escritorio, el campo sigue con su lista bajo él (23/11/2026)
@Component({
  selector: 'app-place-search-modal',
  imports: [
    IonContent,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonSearchbar,
    ModalHeader,
    TranslocoPipe,
  ],
  templateUrl: './place-search-modal.html',
  styleUrl: './place-search-modal.scss',
})
export class PlaceSearchModal implements OnInit {
  private readonly modalController = inject(ModalController);
  private readonly places = inject(PlacesService);
  private readonly location = inject(LocationService);

  // «Origen» o «Destino»: el título de la ventana
  @Input() title = '';
  @Input() placeholder = '';
  @Input() canLocate = false;
  // Lo que ya tenía el campo, para seguir desde ahí
  @Input() initialText = '';

  readonly text = signal('');
  readonly suggestions = signal<readonly PlaceSuggestion[]>([]);
  readonly message = signal<string | null>(null);
  // «Usar mi ubicación»: lo que se está haciendo y la dirección encontrada,
  // arriba de la lista para confirmarla
  readonly status = signal<string | null>(null);
  readonly located = signal<Place | null>(null);

  protected readonly locateIcon = locateOutline;
  protected readonly mapIcon = mapOutline;
  protected readonly placeIcon = locationOutline;
  protected readonly locatedIcon = navigateCircleOutline;
  protected readonly clearIcon = closeCircleOutline;

  private readonly searchbar = viewChild(IonSearchbar);
  private readonly queries = new Subject<string>();

  constructor() {
    streamSuggestions(this.queries, this.places, () =>
      this.message.set(translate('screens.placeField.unavailable')),
    )
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((suggestions) => this.suggestions.set(suggestions));
  }

  // El texto que había, con sus sugerencias
  ngOnInit(): void {
    this.text.set(this.initialText);
    this.queries.next(this.initialText);
  }

  // Ya abierta: el teclado listo para escribir
  ionViewDidEnter(): void {
    void this.searchbar()?.setFocus();
  }

  handleInput(text: string): void {
    this.text.set(text);
    this.message.set(null);
    this.queries.next(text);
  }

  handleSelect(suggestion: PlaceSuggestion): Promise<boolean> {
    return this.modalController.dismiss(suggestion, 'suggestion' satisfies PlaceSearchRole);
  }

  // Con el permiso ya dado, busca la dirección y la enseña para confirmarla;
  // sin él, el campo abre la ventana que lo explica y lo pide
  async handleLocate(): Promise<void> {
    if ((await this.location.checkPermission()) !== 'granted') {
      await this.modalController.dismiss(null, 'locate' satisfies PlaceSearchRole);
      return;
    }
    this.message.set(null);
    this.located.set(null);
    this.status.set(translate('screens.placeField.buscandoUbicacion'));
    try {
      const place = await this.places.reverse(await this.location.getCurrentPoint());
      if (place.isCovered) {
        this.located.set(place);
      } else {
        this.message.set(
          translate('screens.placeField.aunLlegamosEsperamosTener', {
            municipality: place.municipality,
          }),
        );
      }
    } catch (error) {
      this.message.set(
        error instanceof LocationError
          ? LOCATION_MESSAGES[error.reason]
          : translate('screens.placeField.unavailable'),
      );
    } finally {
      this.status.set(null);
    }
  }

  handleUseLocated(place: Place): Promise<boolean> {
    return this.modalController.dismiss(place, 'place' satisfies PlaceSearchRole);
  }

  handleMap(): Promise<boolean> {
    return this.modalController.dismiss(null, 'map' satisfies PlaceSearchRole);
  }

  // Dejar el campo vacío (en el móvil no se puede borrar escribiendo)
  handleClear(): Promise<boolean> {
    return this.modalController.dismiss(null, 'clear' satisfies PlaceSearchRole);
  }

  handleClose(): Promise<boolean> {
    return this.modalController.dismiss(null, 'cancel');
  }
}
