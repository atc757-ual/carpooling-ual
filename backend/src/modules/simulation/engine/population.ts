import type { ScenarioConfig } from '../scenario-config';

// Supuestos por defecto de la demanda sintética (DP-06, propuesta provisional
// por calibrar con datos de la UAL; ver pendientes de la memoria)
export const DRIVER_SHARE = 0.35;
export const BASELINE_OCCUPANCY = 1.2;
export const DEFAULT_CAPACITY = 4;
export const ARRIVAL_MEAN_MIN = 8 * 60 + 15;
export const ARRIVAL_SD_MIN = 35;
export const ARRIVAL_FROM_MIN = 7 * 60;
export const ARRIVAL_TO_MIN = 10 * 60;
// La vuelta: salida del campus normal 14:30 ± 90 min, de 12:00 a 21:00,
// independiente de la llegada (supuesto provisional, como las llegadas)
export const DEPARTURE_MEAN_MIN = 14 * 60 + 30;
export const DEPARTURE_SD_MIN = 90;
export const DEPARTURE_FROM_MIN = 12 * 60;
export const DEPARTURE_TO_MIN = 21 * 60;
// 60 % en la capital (2-8 km del campus) y el resto en municipios cercanos
const CITY_SHARE = 0.6;
const CITY_KM: [number, number] = [2, 8];
const TOWNS_KM: [number, number] = [8, 20];

export type Random = () => number;

// Un punto en km respecto al campus (el campus es el origen)
export interface PlanePoint {
  x: number;
  y: number;
}

export interface Commuter {
  id: string;
  origin: PlanePoint;
  // Hora a la que quiere llegar, en minutos del día
  desiredArrivalMin: number;
  // Hora a la que quiere salir del campus para volver, en minutos del día
  desiredDepartureMin: number;
  windowMin: number;
}

export interface Driver extends Commuter {
  // Plazas para pasajeros (la capacidad menos el conductor)
  seats: number;
}

export interface Population {
  drivers: Driver[];
  passengers: Commuter[];
  // Quienes van en coche y no comparten
  soloCommuters: Commuter[];
}

// Generador pseudoaleatorio mulberry32: rápido y reproducible por semilla
export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Band {
  meanMin: number;
  sdMin: number;
  range: [number, number];
}

const ARRIVALS: Band = {
  meanMin: ARRIVAL_MEAN_MIN,
  sdMin: ARRIVAL_SD_MIN,
  range: [ARRIVAL_FROM_MIN, ARRIVAL_TO_MIN],
};
const DEPARTURES: Band = {
  meanMin: DEPARTURE_MEAN_MIN,
  sdMin: DEPARTURE_SD_MIN,
  range: [DEPARTURE_FROM_MIN, DEPARTURE_TO_MIN],
};

// Normal por Box-Muller, recortada a la franja
function normalBetween(
  random: Random,
  { meanMin, sdMin, range }: Band,
): number {
  const u = Math.max(random(), Number.EPSILON);
  const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * random());
  const value = meanMin + z * sdMin;
  return Math.round(Math.min(range[1] - 1, Math.max(range[0], value)));
}

function between(random: Random, [min, max]: [number, number]): number {
  return min + random() * (max - min);
}

function randomOrigin(random: Random): PlanePoint {
  const km = between(random, random() < CITY_SHARE ? CITY_KM : TOWNS_KM);
  const angle = random() * 2 * Math.PI;
  return { x: km * Math.cos(angle), y: km * Math.sin(angle) };
}

// S3: la tolerancia de cada usuario, al azar dentro del rango del escenario
function windowOf(config: ScenarioConfig, random: Random): number {
  const range = config.parameters.timeWindowRangeMin;
  if (Array.isArray(range) && range.length === 2) {
    return Math.round(between(random, [Number(range[0]), Number(range[1])]));
  }
  return config.timeWindowMin;
}

// S4: la capacidad de cada coche, una de las del escenario
function capacityOf(config: ScenarioConfig, random: Random): number {
  const capacities = config.parameters.vehicleCapacities;
  if (!Array.isArray(capacities) || capacities.length === 0) {
    return DEFAULT_CAPACITY;
  }
  return Number(capacities[Math.floor(random() * capacities.length)]);
}

// Los usuarios que van en coche propio y su papel. Cada usuario consume
// siempre los mismos números aleatorios en el mismo orden: con la misma
// semilla, el escenario y S0 tienen la misma población (semillas emparejadas)
export function generatePopulation(
  config: ScenarioConfig,
  random: Random,
): Population {
  const carUsers = Math.round(config.users * (config.modalSplit.own_car ?? 0));
  const population: Population = {
    drivers: [],
    passengers: [],
    soloCommuters: [],
  };
  for (let index = 0; index < carUsers; index += 1) {
    const commuter: Commuter = {
      id: `u-${index}`,
      origin: randomOrigin(random),
      desiredArrivalMin: normalBetween(random, ARRIVALS),
      windowMin: windowOf(config, random),
      desiredDepartureMin: 0,
    };
    const capacity = capacityOf(config, random);
    const isAdopter = random() < config.adoptionRate;
    const isDriver = random() < DRIVER_SHARE;
    // La hora de vuelta también se sortea siempre, adopte o no: el escenario
    // y S0 siguen consumiendo los mismos números (semillas emparejadas)
    commuter.desiredDepartureMin = normalBetween(random, DEPARTURES);
    if (!isAdopter) {
      population.soloCommuters.push(commuter);
    } else if (isDriver) {
      population.drivers.push({ ...commuter, seats: capacity - 1 });
    } else {
      population.passengers.push(commuter);
    }
  }
  return population;
}
