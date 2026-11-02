import { Injectable } from '@nestjs/common';
import type { GeoPoint } from '../places/geocoder/geocoder';
import {
  CampusParkingChanges,
  CampusParkingsService,
} from '../places/campus-parkings.service';
import type { CampusParking } from '../places/entities/campus-parking.entity';
import { ParkingInUseError } from '../places/errors/parking-in-use.error';
import { TripStatsService } from '../trips/trip-stats.service';

// Distancia a la que un viaje cuenta como «del parking»: los viajes guardan
// el punto del parking que eligieron, así que basta con un margen pequeño
export const PARKING_IN_USE_RADIUS_METERS = 75;

// Parkings en el panel: compone el catálogo (places) con los viajes (trips),
// que no se conocen entre sí. Un parking con viajes en marcha no se cierra ni
// se mueve de sitio (PARKING_IN_USE); el nombre sí se puede cambiar
@Injectable()
export class AdminParkingsService {
  constructor(
    private readonly parkings: CampusParkingsService,
    private readonly tripStats: TripStatsService,
  ) {}

  async update(
    adminId: string,
    id: string,
    changes: CampusParkingChanges,
  ): Promise<CampusParking> {
    const parking = await this.parkings.get(id);
    const closes = changes.isActive === false && parking.isActive;
    const moves =
      changes.point !== undefined && !samePoint(parking, changes.point);
    if (closes || moves) {
      const [lon, lat] = parking.location.coordinates;
      const activeTrips = await this.tripStats.countActiveNear(
        { lon, lat },
        PARKING_IN_USE_RADIUS_METERS,
      );
      if (activeTrips > 0) {
        throw new ParkingInUseError(id, activeTrips);
      }
    }
    return this.parkings.update(adminId, id, changes);
  }
}

function samePoint(parking: CampusParking, point: GeoPoint): boolean {
  const [lon, lat] = parking.location.coordinates;
  return lon === point.lon && lat === point.lat;
}
