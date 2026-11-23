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
  // Iba en transporte público o de otra forma (no en su coche): si se queda
  // sin compartir, sigue en su modo y no suma ningún coche
  isOtherMode?: boolean;
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

// Un supuesto del escenario entre 0 y 1 (parameters); 0 si no lo trae
function shareOf(config: ScenarioConfig, name: string): number {
  const value = Number(config.parameters[name]);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

// Quienes van en transporte público o de otra forma y se apuntan al
// carpooling (supuestos de DP-06, 0 por defecto): nonCarAdoptionRate, la parte
// que se apunta, y nonCarDriverShare, la de esos que tiene coche y lo sacaría
// si lo comparte
export function otherModeSharesOf(config: ScenarioConfig): {
  adoptionRate: number;
  driverShare: number;
} {
  return {
    adoptionRate: shareOf(config, 'nonCarAdoptionRate'),
    driverShare: shareOf(config, 'nonCarDriverShare'),
  };
}

interface Role {
  adoptionRate: number;
  driverShare: number;
  isOtherMode: boolean;
}

// Un usuario y su papel. Consume siempre los mismos números aleatorios en el
// mismo orden: con la misma semilla, el escenario y S0 tienen la misma
// población (semillas emparejadas)
function addCommuter(
  population: Population,
  id: string,
  context: { config: ScenarioConfig; random: Random; role: Role },
): void {
  const { config, random, role } = context;
  const commuter: Commuter = {
    id,
    origin: randomOrigin(random),
    desiredArrivalMin: normalBetween(random, ARRIVALS),
    windowMin: windowOf(config, random),
    desiredDepartureMin: 0,
  };
  const capacity = capacityOf(config, random);
  const isAdopter = random() < role.adoptionRate;
  const isDriver = random() < role.driverShare;
  // La hora de vuelta también se sortea siempre, adopte o no: el escenario
  // y S0 siguen consumiendo los mismos números (semillas emparejadas)
  commuter.desiredDepartureMin = normalBetween(random, DEPARTURES);
  if (role.isOtherMode) {
    commuter.isOtherMode = true;
  }
  if (!isAdopter) {
    // Quien no va en coche y no se apunta no cuenta: sigue en su modo
    if (!role.isOtherMode) {
      population.soloCommuters.push(commuter);
    }
  } else if (isDriver) {
    population.drivers.push({ ...commuter, seats: capacity - 1 });
  } else {
    population.passengers.push(commuter);
  }
}

// Los usuarios que van en coche propio y su papel y, después (para no cambiar
// los números de los primeros), los de otros modos que se apuntan. Sin esos
// supuestos, ni se generan: la población es la de siempre
export function generatePopulation(
  config: ScenarioConfig,
  random: Random,
): Population {
  const ownCarShare = config.modalSplit.own_car ?? 0;
  const carUsers = Math.round(config.users * ownCarShare);
  const population: Population = {
    drivers: [],
    passengers: [],
    soloCommuters: [],
  };
  const carRole: Role = {
    adoptionRate: config.adoptionRate,
    driverShare: DRIVER_SHARE,
    isOtherMode: false,
  };
  for (let index = 0; index < carUsers; index += 1) {
    addCommuter(population, `u-${index}`, { config, random, role: carRole });
  }
  const otherMode = otherModeSharesOf(config);
  if (otherMode.adoptionRate === 0) {
    return population;
  }
  const otherUsers = config.users - carUsers;
  const otherRole: Role = { ...otherMode, isOtherMode: true };
  for (let index = 0; index < otherUsers; index += 1) {
    addCommuter(population, `o-${index}`, { config, random, role: otherRole });
  }
  return population;
}
