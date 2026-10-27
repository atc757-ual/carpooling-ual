import {
  Component,
  ElementRef,
  effect,
  inject,
  Input,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { close, locateOutline } from 'ionicons/icons';
import type * as Leaflet from 'leaflet';
import { Place } from '../../../core/models/place.model';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';

// Acercamiento del mapa: el de una calle al ajustar un punto, y uno menos
// al ver un lugar (para que se vea lo que tiene alrededor)
const STREET_ZOOM = 17;
const CONTEXT_ZOOM = 16;
const MAX_ZOOM = 19;
const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
// Pin de 24px, anclado por su centro
const PIN_SIZE = 24;

export type LocationStep =
  'checking' | 'intro' | 'locating' | 'map' | 'view' | 'denied' | 'unavailable';

// Lo que devuelve al cerrarse: el punto de la ubicación (role 'located') o
// la dirección elegida en el mapa (role 'select')
export type LocationModalResult = [number, number] | Place;

// Ventana de la ubicación, con dos usos (se abre con ModalController):
// - Pedir la ubicación (sin adjustPoint): explica para qué se usa y pide el
//   permiso (o, si se denegó, cómo activarlo); la devuelve como punto
//   (dismiss(punto, 'located')) para que el campo la traduzca a dirección.
// - Ajustar en el mapa (con adjustPoint): el mapa con un pin que se arrastra
//   (o se toca el mapa para moverlo) y la dirección más cercana; «Usar esta
//   dirección» la devuelve (dismiss(Place, 'select')) solo si está en la zona
@Component({
  selector: 'app-location-modal',
  // ion-page: así Ionic reparte el alto entre la cabecera y el contenido
  host: { class: 'ion-page' },
  imports: [IonButton, IonButtons, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar],
  templateUrl: './location-modal.html',
  styleUrl: './location-modal.scss',
})
export class LocationModal implements OnInit, OnDestroy {
  private readonly modalController = inject(ModalController);
  private readonly location = inject(LocationService);
  private readonly places = inject(PlacesService);

  // Con un punto, se abre directamente el mapa para ajustarlo
  @Input() adjustPoint: [number, number] | null = null;
  // Solo para ver un lugar (p. ej. el parking del campus): el mapa con el pin
  // fijo y el nombre del lugar como título
  @Input() viewPoint: [number, number] | null = null;
  @Input() viewTitle = '';

  // Mientras se comprueba el permiso no se enseña nada (es inmediato)
  readonly step = signal<LocationStep>('checking');
  // [longitud, latitud] del pin
  readonly point = signal<[number, number] | null>(null);
  readonly place = signal<Place | null>(null);
  readonly isResolving = signal(false);
  // No hay dirección cerca del pin, o el servicio falla
  readonly addressError = signal<string | null>(null);

  private readonly mapElement = viewChild<ElementRef<HTMLElement>>('map');
  private map: Leaflet.Map | null = null;
  private pin: Leaflet.Marker | null = null;
  // Recalcula el mapa cuando cambia el tamaño de su caja (p. ej. si se crea
  // mientras la ventana aún está apareciendo: Leaflet lo mediría a 0)
  private resizeObserver: ResizeObserver | null = null;

  protected readonly closeIcon = close;
  protected readonly locateIcon = locateOutline;

  constructor() {
    // El mapa se crea en cuanto su caja está en la página y hay un punto
    effect(() => {
      const element = this.mapElement()?.nativeElement;
      const point = this.point();
      if (element && point && !this.map) {
        void this.createMap(element, point);
      }
    });
  }

  get title(): string {
    if (this.viewPoint) {
      return this.viewTitle;
    }
    return this.adjustPoint ? 'Ajustar en el mapa' : 'Usar mi ubicación';
  }

  // Al ajustar, el mapa. Al pedir la ubicación, la explicación solo si aún no
  // se ha dado el permiso; con él, se busca directamente; sin él (denegado),
  // cómo activarlo
  async ngOnInit(): Promise<void> {
    if (this.viewPoint) {
      this.step.set('view');
      this.point.set(this.viewPoint);
      return;
    }
    if (this.adjustPoint) {
      this.step.set('map');
      await this.movePin(this.adjustPoint);
      return;
    }
    const permission = await this.location.checkPermission();
    if (permission === 'granted') {
      await this.handleLocate();
    } else {
      this.step.set(permission === 'denied' ? 'denied' : 'intro');
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.map?.remove();
  }

  async handleLocate(): Promise<void> {
    this.step.set('locating');
    try {
      const point = await this.location.getCurrentPoint();
      await this.modalController.dismiss(point, 'located');
    } catch (error) {
      this.step.set(
        error instanceof LocationError && error.reason === 'denied' ? 'denied' : 'unavailable',
      );
    }
  }

  // El pin en ese punto y su dirección (al llegar la ubicación, al soltar el
  // pin o al tocar el mapa)
  async movePin(point: [number, number]): Promise<void> {
    this.point.set(point);
    this.pin?.setLatLng([point[1], point[0]]);
    this.place.set(null);
    this.addressError.set(null);
    this.isResolving.set(true);
    try {
      this.place.set(await this.places.reverse(point));
    } catch (error) {
      this.addressError.set(
        (error as { status?: unknown }).status === 404
          ? 'No encontramos una dirección aquí. Mueve el punto a una calle cercana.'
          : 'Ahora no podemos buscar la dirección. Inténtalo de nuevo en un momento.',
      );
    } finally {
      this.isResolving.set(false);
    }
  }

  async handleUse(): Promise<void> {
    const place = this.place();
    if (place?.isCovered) {
      await this.modalController.dismiss(place, 'select');
    }
  }

  async close(): Promise<void> {
    await this.modalController.dismiss(null, 'cancel');
  }

  // Leaflet se descarga solo aquí (no va en el paquete inicial)
  private async createMap(element: HTMLElement, [lon, lat]: [number, number]): Promise<void> {
    // Leaflet 1.9 no es ESM: según cómo se empaquete, sus funciones llegan
    // directamente o dentro de default
    const leafletModule = (await import('leaflet')) as typeof Leaflet & {
      default?: typeof Leaflet;
    };
    const leaflet = leafletModule.default ?? leafletModule;
    this.map = leaflet
      .map(element, { zoomControl: true })
      .setView([lat, lon], this.step() === 'view' ? CONTEXT_ZOOM : STREET_ZOOM);
    leaflet
      .tileLayer(TILES_URL, { maxZoom: MAX_ZOOM, attribution: TILES_ATTRIBUTION })
      .addTo(this.map);
    const isEditable = this.step() !== 'view';
    this.pin = leaflet
      .marker([lat, lon], {
        draggable: isEditable,
        keyboard: isEditable,
        title: isEditable ? 'Tu ubicación (arrástrala para ajustarla)' : this.viewTitle,
        icon: leaflet.divIcon({
          className: 'map-pin',
          iconSize: [PIN_SIZE, PIN_SIZE],
          iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
        }),
      })
      .addTo(this.map);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.map?.invalidateSize());
      this.resizeObserver.observe(element);
    }
    if (!isEditable) {
      return;
    }
    this.pin.on('dragend', () => {
      const { lat: pinLat, lng: pinLon } = this.pin!.getLatLng();
      void this.movePin([pinLon, pinLat]);
    });
    this.map.on('click', ({ latlng }: Leaflet.LeafletMouseEvent) => {
      void this.movePin([latlng.lng, latlng.lat]);
    });
  }
}
