import { Component, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { IonIcon, IonSelect, IonSelectOption, ModalController } from '@ionic/angular';
import { ellipseOutline, locationOutline, swapHorizontal } from 'ionicons/icons';
import { map, startWith, switchMap } from 'rxjs';
import { SearchPlace } from '../../../core/models/trip-search.model';
import { LocationService } from '../../../core/services/location/location.service';
import { PlacesService } from '../../../core/services/places/places.service';
import { CAMPUS_NAME } from '../campus';
import { LocationModal } from '../location-modal/location-modal';
import { PlaceField } from '../place-field/place-field';
import { distanceKm } from '../trip-impact';

// A menos de esta distancia de un parking, se está en el campus
const AT_CAMPUS_KM = 1;
// A menos de esta distancia, la dirección ya elegida es donde se está ahora
const SAME_PLACE_KM = 0.3;

// Los controles del trayecto dentro del formulario de quien lo usa
export interface RouteControls {
  // La dirección de fuera del campus (origen al ir, destino al volver),
  // elegida de las sugerencias; null mientras no se elige
  place: FormControl<SearchPlace | null>;
  // Id del parking del campus (vacío hasta que se elige: cada uno sabe a
  // cuál va)
  parking: FormControl<string>;
  isToCampus: FormControl<boolean>;
}

// Trayecto de Buscar y Publicar: una dirección y un parking del campus. Al
// ir, la dirección es el origen; al volver («Cambiar sentido»), el destino.
// En el móvil, «Cambiar sentido» es un enlace junto a la etiqueta; con sitio,
// un botón gris entre los dos campos. Con el permiso de ubicación ya
// concedido rellena el origen con la dirección del momento y, si se está en
// el campus, propone volver a casa
@Component({
  selector: 'app-route-fields',
  imports: [NgTemplateOutlet, ReactiveFormsModule, IonIcon, IonSelect, IonSelectOption, PlaceField],
  templateUrl: './route-fields.html',
  styleUrl: './route-fields.scss',
})
export class RouteFields implements OnInit {
  private readonly places = inject(PlacesService);
  private readonly location = inject(LocationService);
  private readonly modalController = inject(ModalController);
  private readonly placeField = viewChild(PlaceField);

  // Los controles del formulario de quien lo usa (form.controls)
  readonly controls = input.required<RouteControls>();
  // La etiqueta «Trayecto»: sin ella cuando el paso ya se llama así (Publicar)
  readonly showLabel = input(true);

  // La ubicación del momento está en el campus: lo más seguro es que vuelva a
  // casa, y se le propone cambiar el sentido
  readonly isAtCampus = signal(false);

  // Los controles no son signals: el sentido, para la plantilla
  readonly isToCampus = toSignal(
    toObservable(this.controls).pipe(
      switchMap(({ isToCampus }) => isToCampus.valueChanges.pipe(startWith(isToCampus.value))),
    ),
    { initialValue: true },
  );
  // Hay parking elegido (sin él, no hay nada que ver en el mapa)
  readonly hasParking = toSignal(
    toObservable(this.controls).pipe(
      switchMap(({ parking }) => parking.valueChanges.pipe(startWith(parking.value))),
      map(Boolean),
    ),
    { initialValue: false },
  );

  protected readonly parkings = this.places.parkings;
  protected readonly campusName = CAMPUS_NAME;
  protected readonly originIcon = ellipseOutline;
  protected readonly destinationIcon = locationOutline;
  protected readonly swapIcon = swapHorizontal;

  ngOnInit(): void {
    void this.prefillOrigin();
  }

  // Ahorra escribir el origen: con el permiso de ubicación YA concedido (no se
  // pide al abrir), sin dirección elegida y yendo al campus, rellena el campo
  // con la dirección del momento. Si está en el campus (a menos de 1 km de un
  // parking), no lo rellena: propone volver a casa. La ubicación no se guarda
  private async prefillOrigin(): Promise<void> {
    await this.places.loadParkings();
    const saved = this.controls().place.value;
    const isToCampus = this.controls().isToCampus.value;
    // Con una dirección ya elegida solo se mira si es donde está ahora; sin
    // ella, solo al ir al campus
    if ((!saved && !isToCampus) || (await this.location.checkPermission()) !== 'granted') {
      return;
    }
    const point = await this.location.getCurrentPoint().catch(() => null);
    if (!point) {
      return;
    }
    if (saved) {
      // La dirección elegida es la de aquí: el botón lo muestra (late)
      if (distanceKm(point, saved.coordinates) < SAME_PLACE_KM) {
        this.placeField()?.markFromLocation();
      }
      return;
    }
    const isAtCampus = this.parkings().some(
      ({ location }) => distanceKm(point, location.coordinates) < AT_CAMPUS_KM,
    );
    if (isAtCampus) {
      this.isAtCampus.set(true);
      return;
    }
    await this.placeField()?.fillQuietly(point);
  }

  // «¿Vuelves a casa?»: cambia el sentido y deja de proponerlo
  handleGoHome(): void {
    this.isAtCampus.set(false);
    this.handleSwap();
  }

  // Cambia el sentido: ir al campus o volver de él
  handleSwap(): void {
    const { isToCampus } = this.controls();
    isToCampus.setValue(!isToCampus.value);
  }

  // En rojo con «Elige una dirección de la lista.»
  protected isPlaceInvalid(): boolean {
    const { place } = this.controls();
    return place.touched && place.invalid;
  }

  // «Ver en el mapa»: el parking elegido, en el mapa y sin poder moverlo
  async handleViewParking(): Promise<void> {
    const parkingId = this.controls().parking.value;
    const parking = this.parkings().find(({ id }) => id === parkingId);
    if (!parking) {
      return;
    }
    const modal = await this.modalController.create({
      component: LocationModal,
      componentProps: {
        viewPoint: parking.location.coordinates,
        viewTitle: `${CAMPUS_NAME} · ${parking.name}`,
      },
      cssClass: 'location-dialog',
    });
    await modal.present();
  }
}
