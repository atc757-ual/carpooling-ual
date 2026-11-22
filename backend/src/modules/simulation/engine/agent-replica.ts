import { performance } from 'node:perf_hooks';
import type { ReplicaMetrics, TripStates } from '../simulation-metrics';
import type { SimulationJob } from '../runner/simulation-runner';
import type { ScenarioConfig } from '../scenario-config';
import { DEFAULT_MAX_DETOUR_M } from '../../trips/trip-timing';
import {
  BASELINE_OCCUPANCY,
  Commuter,
  createRandom,
  Driver,
  generatePopulation,
  Population,
  Random,
} from './population';
import {
  addPickup,
  findRide,
  Leg,
  PickupMode,
  RideMatch,
  RideOffer,
  stopsOf,
} from './ride-matcher';
import { slotOf, SLOT_COUNT } from './day-slots';
import { TwinFeed } from './twin-feed';

interface LegResult {
  vehicles: number;
  vehiclesBySlot: number[];
  passengers: number;
  coveredPassengers: number;
  affectedPassengers: number;
  recoveredPassengers: number;
  trips: TripStates;
}

export interface DayResult {
  people: number;
  // Vehículos de los dos tramos (ida y vuelta)
  vehicles: number;
  returnVehicles: number;
  vehiclesBySlot: number[];
  // Tramos de pasajero (cada pasajero, a la ida y a la vuelta)
  passengers: number;
  coveredPassengers: number;
  matchingP95Ms: number;
  affectedPassengers: number;
  recoveredPassengers: number;
  trips: TripStates;
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

// Modo de recogida del escenario (parameters.pickupMode): por el camino, si
// no dice otra cosa. A la vuelta, siempre por el camino, como en la plataforma
function pickupModeOf(config: ScenarioConfig, leg: Leg): PickupMode {
  return leg === 'to-campus' && config.parameters.pickupMode === 'stops'
    ? 'stops'
    : 'on_route';
}

// Cuánto se aparta el conductor por el camino (parameters.maxDetourM): el de
// la plataforma al publicar, si no dice otra cosa
function maxDetourMOf(config: ScenarioConfig): number {
  const value = Number(config.parameters.maxDetourM);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_MAX_DETOUR_M;
}

function publish(
  feed: TwinFeed,
  driver: Driver,
  leg: Leg,
  config: ScenarioConfig,
): RideOffer {
  feed.trip('trip.published', driver.id, {
    vehicleId: `v-${driver.id}`,
    status: 'published',
    seats: driver.seats,
    free: driver.seats,
  });
  const pickupMode = pickupModeOf(config, leg);
  return {
    driver,
    leg,
    pickupMode,
    maxDetourM: maxDetourMOf(config),
    stops: pickupMode === 'stops' ? stopsOf(driver) : [],
    free: driver.seats,
    isCancelled: false,
    passengerIds: [],
    pickups: [],
  };
}

// Asigna al pasajero el mejor viaje y lo registra en el gemelo
function board(feed: TwinFeed, passenger: Commuter, match: RideMatch): void {
  const { offer, meetingPoint } = match;
  const { driver } = offer;
  offer.free -= 1;
  offer.passengerIds.push(passenger.id);
  addPickup(offer, meetingPoint);
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

// Matching voraz por orden de hora deseada (de llegada a la ida y de salida a
// la vuelta); mide cada búsqueda (S2)
function matchAll(
  feed: TwinFeed,
  passengers: readonly Commuter[],
  offers: readonly RideOffer[],
  searchMs: number[],
): Commuter[] {
  const unmatched: Commuter[] = [];
  const hourOf = (commuter: Commuter): number =>
    offers[0]?.leg === 'from-campus'
      ? commuter.desiredDepartureMin
      : commuter.desiredArrivalMin;
  const ordered = [...passengers].sort((a, b) => hourOf(a) - hourOf(b));
  for (const passenger of ordered) {
    const startedAt = performance.now();
    const match = findRide(passenger, offers);
    searchMs.push(performance.now() - startedAt);
    if (match === null) {
      unmatched.push(passenger);
    } else {
      board(feed, passenger, match);
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
    offer.pickups = [];
    offer.free = offer.driver.seats;
    feed.trip('trip.cancelled', tripId, {
      vehicleId: `v-${tripId}`,
      status: 'cancelled',
      seats: offer.driver.seats,
      free: offer.driver.seats,
    });
  }
  return affected;
}

// Cada viaje termina como en la plataforma: con pasajeros, se hace
// (trip.started y trip.finished); sin ninguno, caduca (trip.expired)
function closeTrips(feed: TwinFeed, offers: readonly RideOffer[]): void {
  for (const offer of offers.filter((o) => !o.isCancelled)) {
    const tripId = offer.driver.id;
    const state = {
      vehicleId: `v-${tripId}`,
      seats: offer.driver.seats,
      free: offer.free,
    };
    if (offer.passengerIds.length === 0) {
      feed.trip('trip.expired', tripId, { ...state, status: 'expired' });
      continue;
    }
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

// Los estados finales de los viajes y los compartidos, según el gemelo
function readTrips(feed: TwinFeed): {
  states: TripStates;
  sharedIds: Set<string>;
} {
  const states: TripStates = { finished: 0, expired: 0, cancelled: 0 };
  const sharedIds = new Set<string>();
  for (const trip of feed.twin.trips.values()) {
    if (trip.status === 'finished') {
      states.finished += 1;
      if (trip.passengersOnBoard > 0) {
        sharedIds.add(trip.id);
      }
    } else if (trip.status === 'expired') {
      states.expired += 1;
    } else if (trip.status === 'cancelled') {
      states.cancelled += 1;
    }
  }
  return { states, sharedIds };
}

// Un tramo del día (la ida o la vuelta) con su propio gemelo (DP-10). Los
// vehículos se leen del gemelo: los viajes compartidos que han terminado, más
// quienes van sin compartir (a 1,2 personas por coche)
function simulateLeg(
  leg: Leg,
  population: Population,
  config: ScenarioConfig,
  context: { random: Random; searchMs: number[] },
): LegResult {
  const feed = new TwinFeed();
  const offers = population.drivers.map((driver) =>
    publish(feed, driver, leg, config),
  );
  const { random, searchMs } = context;
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
  closeTrips(feed, offers);

  const unmatched = [...firstUnmatched, ...stillUnmatched];
  const { states, sharedIds } = readTrips(feed);
  // Quien no comparte coche (no adopta, se queda sin plaza o conduce sin
  // pasajeros) viaja como hoy: a 1,2 personas por coche. Un viaje compartido
  // es un coche entero
  const alone = [
    ...population.soloCommuters,
    ...unmatched,
    ...population.drivers.filter((driver) => !sharedIds.has(driver.id)),
  ];
  const vehiclesBySlot = new Array<number>(SLOT_COUNT).fill(0);
  for (const commuter of alone) {
    vehiclesBySlot[slotOf(commuter, leg)] += 1 / BASELINE_OCCUPANCY;
  }
  for (const driver of population.drivers) {
    if (sharedIds.has(driver.id)) {
      vehiclesBySlot[slotOf(driver, leg)] += 1;
    }
  }
  return {
    vehicles: alone.length / BASELINE_OCCUPANCY + sharedIds.size,
    vehiclesBySlot,
    passengers: population.passengers.length,
    coveredPassengers: population.passengers.length - unmatched.length,
    affectedPassengers: affected.length,
    recoveredPassengers: affected.length - stillUnmatched.length,
    trips: states,
  };
}

// Un día: la ida al campus por la mañana y la vuelta por la tarde, cada tramo
// emparejado por separado (quien se queda sin plaza en uno va en su coche en
// ese tramo)
export function simulateDay(config: ScenarioConfig, random: Random): DayResult {
  const population = generatePopulation(config, random);
  const context = { random, searchMs: [] as number[] };
  const toCampus = simulateLeg('to-campus', population, config, context);
  const fromCampus = simulateLeg('from-campus', population, config, context);
  const legs = [toCampus, fromCampus];
  const sum = (pick: (leg: LegResult) => number): number =>
    legs.reduce((total, leg) => total + pick(leg), 0);
  return {
    people:
      population.soloCommuters.length +
      population.drivers.length +
      population.passengers.length,
    vehicles: sum((leg) => leg.vehicles),
    returnVehicles: fromCampus.vehicles,
    vehiclesBySlot: toCampus.vehiclesBySlot.map(
      (vehicles, index) => vehicles + fromCampus.vehiclesBySlot[index],
    ),
    passengers: sum((leg) => leg.passengers),
    coveredPassengers: sum((leg) => leg.coveredPassengers),
    matchingP95Ms: p95(context.searchMs),
    affectedPassengers: sum((leg) => leg.affectedPassengers),
    recoveredPassengers: sum((leg) => leg.recoveredPassengers),
    trips: {
      finished: sum((leg) => leg.trips.finished),
      expired: sum((leg) => leg.trips.expired),
      cancelled: sum((leg) => leg.trips.cancelled),
    },
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

function avoidedPct(base: number, scenario: number): number {
  return base > 0 ? round(((base - scenario) / base) * 100) : 0;
}

// Una réplica: el escenario y la base (S0) con la misma semilla, es decir,
// con la misma población (semillas emparejadas). Los vehículos y la ocupación
// son los del día entero (ida y vuelta); cada persona hace dos viajes
export function agentReplica(
  job: SimulationJob,
  index: number,
): ReplicaMetrics {
  const seed = job.seed + index;
  const day = simulateDay(job.scenario, createRandom(seed));
  const base = simulateDay(job.baseline, createRandom(seed));
  const hasIncidents = Number(job.scenario.parameters.cancellationRate) > 0;
  const personTrips = (result: DayResult): number => result.people * 2;
  return {
    replica: index + 1,
    seed,
    vehiclesUsed: Math.round(day.vehicles),
    baselineVehiclesUsed: Math.round(base.vehicles),
    vehiclesAvoidedPct: avoidedPct(base.vehicles, day.vehicles),
    returnVehiclesUsed: Math.round(day.returnVehicles),
    returnBaselineVehiclesUsed: Math.round(base.returnVehicles),
    requestsCoveredPct:
      day.passengers > 0
        ? round((day.coveredPassengers / day.passengers) * 100)
        : 0,
    averageOccupancy:
      day.vehicles > 0 ? round(personTrips(day) / day.vehicles) : 0,
    baselineAverageOccupancy:
      base.vehicles > 0 ? round(personTrips(base) / base.vehicles) : 0,
    matchingP95Ms: round(day.matchingP95Ms),
    recoveryPct: hasIncidents ? recoveryPctOf(day) : null,
    trips: day.trips,
    vehiclesBySlot: day.vehiclesBySlot.map(Math.round),
    baselineVehiclesBySlot: base.vehiclesBySlot.map(Math.round),
  };
}
