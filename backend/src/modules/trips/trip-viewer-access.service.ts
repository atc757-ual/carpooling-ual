import { Injectable } from '@nestjs/common';
import type { Point } from 'typeorm';
import { CampusParkingsService } from '../places/campus-parkings.service';
import type { Trip } from './entities/trip.entity';
import { approximatePoint, withoutStreetNumber } from './trip-location-privacy';
import type { TripRouteView, TripView } from './trips.service';

// Quién pide el viaje desde la app. Ser administrador no cuenta: en la app
// ve lo mismo que cualquier pasajero; los datos exactos, en el panel
// (/admin/...), que no pasa por aquí
export interface TripViewer {
  id: string;
}

// Si un usuario participa en el viaje (p. ej. es un pasajero aceptado)
export type TripParticipantCheck = (
  tripId: string,
  userId: string,
) => Promise<boolean>;

// Un extremo a menos de esta distancia de un parking del campus es ese
// parking: un lugar público (el mismo radio que usa el panel para «en uso»)
export const CAMPUS_PARKING_RADIUS_METERS = 75;

// Los extremos del viaje son datos personales (suelen ser la casa del
// conductor). El conductor, sus pasajeros aceptados y los administradores
// los ven exactos; el resto (p. ej. quien busca viaje), redondeados a unos
// 500 m y sin la ruta. Los parkings del campus se muestran siempre tal cual
@Injectable()
export class TripViewerAccessService {
  private readonly participantChecks: TripParticipantCheck[] = [];

  constructor(private readonly campusParkings: CampusParkingsService) {}

  // Patrón observador: las solicitudes de plaza dicen quién es pasajero
  // aceptado sin que trips dependa de ellas
  onParticipantCheck(check: TripParticipantCheck): void {
    this.participantChecks.push(check);
  }

  async canSeeExactLocation(trip: Trip, viewer: TripViewer): Promise<boolean> {
    if (trip.driverId === viewer.id) {
      return true;
    }
    const answers = await Promise.all(
      this.participantChecks.map((check) => check(trip.id, viewer.id)),
    );
    return answers.some(Boolean);
  }

  async tripFor(view: TripView, viewer: TripViewer): Promise<TripView> {
    if (await this.canSeeExactLocation(view.trip, viewer)) {
      return view;
    }
    const [origin, destination] = await Promise.all([
      this.publicPlace(view.trip.origin, view.trip.originName),
      this.publicPlace(view.trip.destination, view.trip.destinationName),
    ]);
    return {
      ...view,
      trip: {
        ...view.trip,
        origin: origin.point,
        originName: origin.name,
        destination: destination.point,
        destinationName: destination.name,
      },
      isLocationApproximate: true,
    };
  }

  async routeFor(
    view: TripRouteView,
    viewer: TripViewer,
  ): Promise<TripRouteView> {
    if (await this.canSeeExactLocation(view.trip, viewer)) {
      return view;
    }
    return { ...view, isGeometryHidden: true };
  }

  // Un extremo del viaje para quien no tiene plaza: los parkings del campus,
  // tal cual; el resto, el punto redondeado y el nombre sin el número de
  // portal (la calle, no la casa)
  private async publicPlace(
    point: Point,
    name: string | null,
  ): Promise<{ point: Point; name: string | null }> {
    const isCampus = await this.campusParkings.isNearAny(
      point,
      CAMPUS_PARKING_RADIUS_METERS,
    );
    return isCampus
      ? { point, name }
      : { point: approximatePoint(point), name: withoutStreetNumber(name) };
  }
}
