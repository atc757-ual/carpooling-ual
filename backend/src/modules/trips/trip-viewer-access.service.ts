import { Injectable } from '@nestjs/common';
import type { Point } from 'typeorm';
import { CampusParkingsService } from '../places/campus-parkings.service';
import type { Trip } from './entities/trip.entity';
import { approximatePoint } from './trip-location-privacy';
import type { TripRouteView, TripView } from './trips.service';

// Quién pide el viaje
export interface TripViewer {
  id: string;
  isAdmin: boolean;
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
    if (viewer.isAdmin || trip.driverId === viewer.id) {
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
      this.publicPoint(view.trip.origin),
      this.publicPoint(view.trip.destination),
    ]);
    return {
      ...view,
      trip: { ...view.trip, origin, destination },
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

  private async publicPoint(point: Point): Promise<Point> {
    const isCampus = await this.campusParkings.isNearAny(
      point,
      CAMPUS_PARKING_RADIUS_METERS,
    );
    return isCampus ? point : approximatePoint(point);
  }
}
