import type { ScenarioConfig } from '../scenario-config';
import type { ReplicaMetrics } from '../simulation-metrics';
import type { SimulationJob } from './simulation-runner';

// Métricas inventadas pero deterministas de una réplica, para desarrollar el
// panel sin el motor real: la misma semilla da siempre el mismo resultado.
// Las fórmulas solo buscan valores verosímiles; no modelan nada

const SLOT_MINUTES = 30;
// Ocupación sin carpooling (personas por coche) de la que parte la base
const BASELINE_OCCUPANCY = 1.2;
// Parte de los usuarios que comparten coche que viajan como pasajeros
const PASSENGER_SHARE = 0.65;
// Plazas por vehículo si el escenario no fija capacidades
const DEFAULT_SEATS = 4;

// Generador pseudoaleatorio mulberry32: rápido y reproducible por semilla
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toTime(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, '0');
  return `${hours}:${String(minutes % 60).padStart(2, '0')}`;
}

// Inicio de cada franja de 30 minutos entre dos horas (en minutos del día)
export function slotsBetween(startMin: number, endMin: number): string[] {
  const slots: string[] = [];
  for (let m = startMin; m < endMin; m += SLOT_MINUTES) {
    slots.push(toTime(m));
  }
  return slots;
}

// Franja de llegadas al campus del motor falso: de 07:00 a 10:00
export const FAKE_SLOTS = slotsBetween(7 * 60, 10 * 60);

// Media de plazas (parameters.vehicleCapacities) o 4 si no hay
function averageSeats(config: ScenarioConfig): number {
  const capacities = config.parameters.vehicleCapacities;
  if (!Array.isArray(capacities) || capacities.length === 0) {
    return DEFAULT_SEATS;
  }
  const values = capacities.map(Number);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function cancellationRate(config: ScenarioConfig): number {
  const rate = Number(config.parameters.cancellationRate ?? 0);
  return Number.isFinite(rate) ? rate : 0;
}

// Reparte los vehículos entre las franjas con un pico en el primer tercio
function distribute(vehicles: number, slotCount: number): number[] {
  const peak = slotCount * 0.35;
  const width = Math.max(1, slotCount / 4);
  const weights = Array.from({ length: slotCount }, (_, i) =>
    Math.exp(-((i - peak) ** 2) / (2 * width ** 2)),
  );
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  return weights.map((weight) => Math.round((vehicles * weight) / total));
}

export function fakeReplica(job: SimulationJob, index: number): ReplicaMetrics {
  const seed = job.seed + index;
  const random = createRandom(seed);
  const noise = (spread: number): number => 1 + (random() * 2 - 1) * spread;
  const config = job.scenario;
  const incidents = cancellationRate(config);

  const carUsers = config.users * (job.baseline.modalSplit.own_car ?? 0);
  const baselineOccupancy = BASELINE_OCCUPANCY * noise(0.03);
  const baselineVehicles = carUsers / baselineOccupancy;

  const seatsFactor = Math.min(averageSeats(config), 4) / 4;
  const demandFactor = config.users > 500 ? 1.1 : 1;
  const covered =
    config.adoptionRate === 0
      ? 0
      : clamp(
          (0.62 + 0.15 * seatsFactor) *
            demandFactor *
            (1 - incidents) *
            noise(0.04),
          0,
          1,
        );
  const matchedPassengers =
    carUsers * config.adoptionRate * PASSENGER_SHARE * covered;
  const vehicles = (carUsers - matchedPassengers) / baselineOccupancy;

  return {
    replica: index + 1,
    seed,
    vehiclesUsed: Math.round(vehicles),
    baselineVehiclesUsed: Math.round(baselineVehicles),
    vehiclesAvoidedPct: round(
      ((baselineVehicles - vehicles) / baselineVehicles) * 100,
    ),
    requestsCoveredPct: round(covered * 100),
    averageOccupancy: round(carUsers / vehicles),
    baselineAverageOccupancy: round(baselineOccupancy),
    matchingP95Ms: Math.round((120 + config.users * 0.25) * noise(0.1)),
    recoveryPct: incidents > 0 ? round(clamp(80 * noise(0.08), 0, 100)) : null,
    vehiclesBySlot: distribute(vehicles, FAKE_SLOTS.length),
    baselineVehiclesBySlot: distribute(baselineVehicles, FAKE_SLOTS.length),
  };
}
