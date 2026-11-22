import { Injectable } from '@nestjs/common';
import { RequestStatsService } from '../requests/request-stats.service';
import { TripStatsService } from '../trips/trip-stats.service';
import { savedCo2Kg, sharedKm } from './saved-co2';

export interface UserImpact {
  tripsDone: number;
  co2Kg: number;
  driverKm: number;
  passengerKm: number;
}

// El impacto de un usuario con sus dos papeles: el CO₂ que no se emitió
// (como conductor, el de un coche por cada pasajero que llevó; como
// pasajero, el de su coche en cada viaje que hizo) y los km que compartió con
// cada papel. Sin «coches evitados»: no todos vendrían en su coche (hay quien
// viene en bus). Cada módulo da sus datos (trips y requests), sin tocar sus
// tablas
@Injectable()
export class UserImpactService {
  constructor(
    private readonly tripStats: TripStatsService,
    private readonly requestStats: RequestStatsService,
  ) {}

  async getImpact(userId: string): Promise<UserImpact> {
    const [driverLegs, rideTripIds] = await Promise.all([
      this.tripStats.finishedLegsByDriver(userId),
      this.requestStats.completedTripIds(userId),
    ]);
    const passengerLegs = await this.tripStats.passengerLegs(rideTripIds);
    const legs = [...driverLegs, ...passengerLegs];
    return {
      tripsDone: legs.length,
      co2Kg: savedCo2Kg(legs),
      driverKm: sharedKm(driverLegs),
      passengerKm: sharedKm(passengerLegs),
    };
  }
}
