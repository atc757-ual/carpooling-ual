import { Component, computed, inject, input, resource } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonIcon,
  IonSpinner,
} from '@ionic/angular';
import { carOutline } from 'ionicons/icons';
import { DriverTrip, TripStatus } from '../../../core/models/driver.model';
import { SeatRequest } from '../../../core/models/seat-request.model';
import { VehicleColorsStore } from '../../../core/services/catalogs/vehicle-colors.store';
import { DriverService } from '../../../core/services/drivers/driver.service';
import { TripsService } from '../../../core/services/trips/trips.service';
import {
  RouteStop,
  RouteTimeline,
} from '../../../shared/components/ui/route-timeline/route-timeline';
import {
  RoutePoint,
  TripRouteMap,
} from '../../../shared/components/ui/trip-route-map/trip-route-map';
import { getFirstName } from '../../matching/trip-driver/trip-driver';
import { buildDriverRouteStops } from './driver-route-stops';

// Viajes cuyas recogidas aceptadas se pintan en el recorrido
const STATUSES_WITH_PICKUPS = new Set<TripStatus>(['published', 'confirmed', 'in_progress']);

// «Tu recorrido» en el detalle de un viaje del conductor: el mapa con la
// ruta, las paradas con su hora (la llegada, la salida más la duración de la
// ruta), los datos del trayecto (distancia, duración y desvío máximo) y el
// vehículo con el que se publicó. Con pasajeros aceptados, sus recogidas son
// paradas del recorrido (R en el mapa) con su hora aproximada; las solicitudes
// pendientes no lo tocan
@Component({
  selector: 'app-driver-trip-route',
  imports: [
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonIcon,
    IonSpinner,
    RouteTimeline,
    TripRouteMap,
  ],
  templateUrl: './driver-trip-route.html',
  styleUrl: './driver-trip-route.scss',
})
export class DriverTripRoute {
  private readonly tripsService = inject(TripsService);
  private readonly colors = inject(VehicleColorsStore);
  private readonly driver = inject(DriverService);

  readonly trip = input.required<DriverTrip>();

  // La ruta y el viaje completo (con el vehículo)
  readonly details = resource({
    params: () => this.trip().id,
    loader: async ({ params: tripId }) => {
      const [trip, route] = await Promise.all([
        this.tripsService.getTrip(tripId),
        this.tripsService.getRoute(tripId),
      ]);
      return { trip, route };
    },
  });
  readonly route = computed(() => (this.details.hasValue() ? this.details.value().route : null));
  readonly vehicle = computed(() =>
    this.details.hasValue() ? this.details.value().trip.vehicle : null,
  );

  // Las solicitudes aceptadas, ordenadas por hora de recogida. Depende del
  // viaje entero: al aceptar o rechazar, la página lo recarga y esto también
  private readonly requests = resource({
    params: () => (STATUSES_WITH_PICKUPS.has(this.trip().status) ? this.trip() : undefined),
    loader: ({ params: trip }) => this.driver.listTripRequests(trip.id),
  });
  readonly acceptedPickups = computed<SeatRequest[]>(() =>
    (this.requests.hasValue() ? this.requests.value() : [])
      .filter((request) => request.status === 'accepted' && request.pickupLocation)
      .sort((a, b) => Date.parse(a.pickupAt ?? '') - Date.parse(b.pickupAt ?? '')),
  );
  // En el mapa: las paradas del viaje o, en el camino, el punto de cada uno
  readonly pickupPoints = computed<RoutePoint[]>(() =>
    this.trip().stops.length > 0
      ? this.trip().stops.map(({ location, name }) => ({
          coordinates: location.coordinates,
          label: `Parada: ${name}`,
        }))
      : this.acceptedPickupPoints(),
  );
  private readonly acceptedPickupPoints = computed<RoutePoint[]>(() =>
    this.acceptedPickups().flatMap(({ pickupLocation, passenger }) =>
      pickupLocation
        ? [
            {
              coordinates: pickupLocation.coordinates,
              label: `Recogida de ${getFirstName(passenger.name)}`,
            },
          ]
        : [],
    ),
  );

  readonly origin = computed<RoutePoint>(() => ({
    coordinates: this.trip().origin.coordinates,
    label: this.trip().originName ?? 'Salida',
  }));
  readonly destination = computed<RoutePoint>(() => ({
    coordinates: this.trip().destination.coordinates,
    label: this.trip().destinationName ?? 'Destino',
  }));

  // Sale a su hora y llega, más o menos, tras la duración de la ruta
  readonly stops = computed<RouteStop[]>(() =>
    buildDriverRouteStops(this.trip(), this.acceptedPickups(), this.route()?.durationMin),
  );

  // «12,4 km», «18 min», «hasta 10 min»
  readonly facts = computed(() => {
    const route = this.route();
    return [
      {
        label: 'Distancia',
        value: route ? `${route.distanceKm.toFixed(1).replace('.', ',')} km` : '—',
      },
      { label: 'Duración', value: route ? `${Math.round(route.durationMin)} min` : '—' },
      { label: 'Desvío máximo', value: `${this.trip().maxDetourMin} min` },
    ];
  });

  protected readonly carIcon = carOutline;
  protected readonly vehicleColor = (color: string | null) => this.colors.label(color);
  protected readonly vehicleSwatch = (color: string | null) => this.colors.swatch(color);
}
