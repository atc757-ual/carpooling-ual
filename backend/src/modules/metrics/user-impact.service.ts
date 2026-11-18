import { Injectable } from '@nestjs/common';
import { RequestStatsService } from '../requests/request-stats.service';
import { TripStatsService } from '../trips/trip-stats.service';
import { savedCo2Kg } from './saved-co2';

export interface UserImpact {
  tripsDone: number;
  carsAvoided: number;
  co2Kg: number;
}

// El impacto de un usuario con sus dos papeles: como conductor, un coche
// menos por cada pasajero que llevó; como pasajero, el suyo en cada viaje que
// hizo. Cada módulo da sus datos (trips y requests), sin tocar sus tablas
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
      carsAvoided: legs.reduce((sum, leg) => sum + leg.carsAvoided, 0),
      co2Kg: savedCo2Kg(legs),
    };
  }
}
