import { performance } from 'node:perf_hooks';
import type { ReplicaMetrics } from '../simulation-metrics';
import type { SimulationJob } from '../runner/simulation-runner';
import type { ScenarioConfig } from '../scenario-config';
import {
  ARRIVAL_FROM_MIN,
  ARRIVAL_TO_MIN,
  BASELINE_OCCUPANCY,
  Commuter,
  createRandom,
  generatePopulation,
  Random,
} from './population';
import { findRide, RideOffer } from './ride-matcher';
import { TwinFeed } from './twin-feed';

// Franjas de 30 minutos de las llegadas al campus (07:00 a 10:00)
const SLOT_MINUTES = 30;
const SLOT_COUNT = (ARRIVAL_TO_MIN - ARRIVAL_FROM_MIN) / SLOT_MINUTES;

export interface DayResult {
  people: number;
  vehicles: number;
  vehiclesBySlot: number[];
  passengers: number;
  coveredPassengers: number;
  matchingP95Ms: number;
  affectedPassengers: number;
  recoveredPassengers: number;
}

function slotOf(commuter: Commuter): number {
  return Math.floor(
    (commuter.desiredArrivalMin - ARRIVAL_FROM_MIN) / SLOT_MINUTES,
  );
}

// Percentil 95 por el método del rango más cercano
function p95(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(0.95 * sorted.length) - 1];
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// Asigna al pasajero el mejor viaje y lo registra en el gemelo
function board(feed: TwinFeed, passenger: Commuter, offer: RideOffer): void {
  const { driver } = offer;
  offer.free -= 1;
  offer.passengerIds.push(passenger.id);
  const tripId = driver.id;
  feed.request('request.created', passenger.id, { tripId, status: 'pending' });
  feed.request('request.accepted', passenger.id, {
    tripId,
    status: 'accepted',
  });
  feed.trip('trip.updated', tripId, {
    vehicleId: `v-${driver.id}`,
    status: 'confirmed',
    seats: driver.seats,
    free: offer.free,
  });
}

// Matching voraz por orden de hora deseada; mide cada búsqueda (S2)
function matchAll(
  feed: TwinFeed,
  passengers: readonly Commuter[],
  offers: readonly RideOffer[],
  searchMs: number[],
): Commuter[] {
  const unmatched: Commuter[] = [];
  const ordered = [...passengers].sort(
    (a, b) => a.desiredArrivalMin - b.desiredArrivalMin,
  );
  for (const passenger of ordered) {
    const startedAt = performance.now();
    const offer = findRide(passenger, offers);
    searchMs.push(performance.now() - startedAt);
    if (offer === null) {
      unmatched.push(passenger);
    } else {
      board(feed, passenger, offer);
    }
  }
  return unmatched;
}

// S5: cada conductor cancela con la probabilidad del escenario; sus
// pasajeros pierden la plaza y vuelven a buscar. Devuelve los afectados
function cancelSomeTrips(
  feed: TwinFeed,
  offers: readonly RideOffer[],
  rate: number,
  random: Random,
): string[] {
  const affected: string[] = [];
  for (const offer of offers) {
    if (rate <= 0 || random() >= rate) {
      continue;
    }
    offer.isCancelled = true;
    const tripId = offer.driver.id;
    for (const passengerId of offer.passengerIds) {
      feed.request('request.cancelled', passengerId, {
        tripId,
        status: 'cancelled',
      });
      affected.push(passengerId);
    }
    offer.passengerIds = [];
    feed.trip('trip.cancelled', tripId, {
      vehicleId: `v-${tripId}`,
      status: 'cancelled',
      seats: offer.driver.seats,
      free: offer.driver.seats,
    });
  }
  return affected;
}

function runTrips(feed: TwinFeed, offers: readonly RideOffer[]): void {
  for (const offer of offers.filter((o) => !o.isCancelled)) {
    const tripId = offer.driver.id;
    const state = {
      vehicleId: `v-${tripId}`,
      seats: offer.driver.seats,
      free: offer.free,
    };
    feed.trip('trip.started', tripId, { ...state, status: 'in_progress' });
    for (const passengerId of offer.passengerIds) {
      feed.request('request.boarded', passengerId, {
        tripId,
        status: 'accepted',
        isBoarded: true,
      });
    }
    feed.trip('trip.finished', tripId, { ...state, status: 'finished' });
  }
}

// Los viajes terminados con algún pasajero a bordo, según el gemelo
function sharedTripsOf(feed: TwinFeed): Set<string> {
  const ids = new Set<string>();
  for (const trip of feed.twin.trips.values()) {
    if (trip.status === 'finished' && trip.passengersOnBoard > 0) {
      ids.add(trip.id);
    }
  }
  return ids;
}

// Un día de llegadas al campus con su propio gemelo (DP-10). Los vehículos se
// leen del gemelo: los viajes compartidos que ha terminado, más quienes van
// sin compartir (a 1,2 personas por coche)
export function simulateDay(config: ScenarioConfig, random: Random): DayResult {
  const population = generatePopulation(config, random);
  const feed = new TwinFeed();
  const offers: RideOffer[] = population.drivers.map((driver) => {
    feed.trip('trip.published', driver.id, {
      vehicleId: `v-${driver.id}`,
      status: 'published',
      seats: driver.seats,
      free: driver.seats,
    });
    return { driver, free: driver.seats, isCancelled: false, passengerIds: [] };
  });
  const searchMs: number[] = [];
  const firstUnmatched = matchAll(
    feed,
    population.passengers,
    offers,
    searchMs,
  );
  const rate = Number(config.parameters.cancellationRate ?? 0);
  const affectedIds = new Set(cancelSomeTrips(feed, offers, rate, random));
  const affected = population.passengers.filter((p) => affectedIds.has(p.id));
  const stillUnmatched = matchAll(feed, affected, offers, searchMs);
  runTrips(feed, offers);

  const unmatched = [...firstUnmatched, ...stillUnmatched];
  const sharedTripIds = sharedTripsOf(feed);
  // Quien no comparte coche (no adopta, se queda sin plaza o conduce sin
  // pasajeros) viaja como hoy: a 1,2 personas por coche. Un viaje compartido
  // es un coche entero
  const alone = [
    ...population.soloCommuters,
    ...unmatched,
    ...population.drivers.filter((driver) => !sharedTripIds.has(driver.id)),
  ];
  const vehiclesBySlot = new Array<number>(SLOT_COUNT).fill(0);
  for (const commuter of alone) {
    vehiclesBySlot[slotOf(commuter)] += 1 / BASELINE_OCCUPANCY;
  }
  for (const driver of population.drivers) {
    if (sharedTripIds.has(driver.id)) {
      vehiclesBySlot[slotOf(driver)] += 1;
    }
  }
  return {
    people:
      population.soloCommuters.length +
      population.drivers.length +
      population.passengers.length,
    vehicles: alone.length / BASELINE_OCCUPANCY + sharedTripIds.size,
    vehiclesBySlot,
    passengers: population.passengers.length,
    coveredPassengers: population.passengers.length - unmatched.length,
    matchingP95Ms: p95(searchMs),
    affectedPassengers: affected.length,
    recoveredPassengers: affected.length - stillUnmatched.length,
  };
}

// S5: pasajeros afectados por una cancelación que encuentran otro viaje; sin
// afectados, la recuperación es completa
function recoveryPctOf(day: DayResult): number {
  if (day.affectedPassengers === 0) {
    return 100;
  }
  return round((day.recoveredPassengers / day.affectedPassengers) * 100);
}

// Una réplica: el escenario y la base (S0) con la misma semilla, es decir,
// con la misma población (semillas emparejadas)
export function agentReplica(
  job: SimulationJob,
  index: number,
): ReplicaMetrics {
  const seed = job.seed + index;
  const day = simulateDay(job.scenario, createRandom(seed));
  const base = simulateDay(job.baseline, createRandom(seed));
  const hasIncidents = Number(job.scenario.parameters.cancellationRate) > 0;
  return {
    replica: index + 1,
    seed,
    vehiclesUsed: Math.round(day.vehicles),
    baselineVehiclesUsed: Math.round(base.vehicles),
    vehiclesAvoidedPct:
      base.vehicles > 0
        ? round(((base.vehicles - day.vehicles) / base.vehicles) * 100)
        : 0,
    requestsCoveredPct:
      day.passengers > 0
        ? round((day.coveredPassengers / day.passengers) * 100)
        : 0,
    averageOccupancy: day.vehicles > 0 ? round(day.people / day.vehicles) : 0,
    baselineAverageOccupancy:
      base.vehicles > 0 ? round(base.people / base.vehicles) : 0,
    matchingP95Ms: round(day.matchingP95Ms),
    recoveryPct: hasIncidents ? recoveryPctOf(day) : null,
    vehiclesBySlot: day.vehiclesBySlot.map(Math.round),
    baselineVehiclesBySlot: base.vehiclesBySlot.map(Math.round),
  };
}
