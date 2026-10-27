import { Component, ElementRef, effect, inject, OnDestroy, signal, viewChild } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { closeOutline, locateOutline } from 'ionicons/icons';
import type * as Leaflet from 'leaflet';
import { Place } from '../../../core/models/place.model';
import { LocationError, LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';

// Acercamiento del mapa: el de una calle
const STREET_ZOOM = 17;
const MAX_ZOOM = 19;
const TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATTRIBUTION = '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
// Pin de 24px, anclado por su centro
const PIN_SIZE = 24;

export type LocationStep = 'intro' | 'locating' | 'map' | 'denied' | 'unavailable';

// «Usar mi ubicación»: explica para qué se usa y la pide (con el permiso del
// navegador o del móvil), la muestra en un mapa con un pin que se puede
// arrastrar (o tocar el mapa para moverlo) y la traduce a la dirección más
// cercana. «Usar esta dirección» la devuelve (dismiss con la Place) solo si
// está en la zona de servicio. Se abre con ModalController
@Component({
  selector: 'app-location-modal',
  // ion-page: así Ionic reparte el alto entre la cabecera y el contenido
  host: { class: 'ion-page' },
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonSpinner,
    IonTitle,
    IonToolbar,
  ],
  templateUrl: './location-modal.html',
  styleUrl: './location-modal.scss',
})
export class LocationModal implements OnDestroy {
  private readonly modalController = inject(ModalController);
  private readonly location = inject(LocationService);
  private readonly places = inject(PlacesService);

  readonly step = signal<LocationStep>('intro');
  // [longitud, latitud] del pin
  readonly point = signal<[number, number] | null>(null);
  readonly place = signal<Place | null>(null);
  readonly isResolving = signal(false);
  // No hay dirección cerca del pin, o el servicio falla
  readonly addressError = signal<string | null>(null);

  private readonly mapElement = viewChild<ElementRef<HTMLElement>>('map');
  private map: Leaflet.Map | null = null;
  private pin: Leaflet.Marker | null = null;

  protected readonly closeIcon = closeOutline;
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

  ngOnDestroy(): void {
    this.map?.remove();
  }

  async handleLocate(): Promise<void> {
    this.step.set('locating');
    try {
      const point = await this.location.getCurrentPoint();
      this.step.set('map');
      await this.movePin(point);
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
    const leaflet = await import('leaflet');
    this.map = leaflet.map(element, { zoomControl: true }).setView([lat, lon], STREET_ZOOM);
    leaflet
      .tileLayer(TILES_URL, { maxZoom: MAX_ZOOM, attribution: TILES_ATTRIBUTION })
      .addTo(this.map);
    this.pin = leaflet
      .marker([lat, lon], {
        draggable: true,
        keyboard: true,
        title: 'Tu ubicación (arrástrala para ajustarla)',
        icon: leaflet.divIcon({
          className: 'map-pin',
          iconSize: [PIN_SIZE, PIN_SIZE],
          iconAnchor: [PIN_SIZE / 2, PIN_SIZE / 2],
        }),
      })
      .addTo(this.map);
    this.pin.on('dragend', () => {
      const { lat: pinLat, lng: pinLon } = this.pin!.getLatLng();
      void this.movePin([pinLon, pinLat]);
    });
    this.map.on('click', ({ latlng }: Leaflet.LeafletMouseEvent) => {
      void this.movePin([latlng.lng, latlng.lat]);
    });
  }
}
