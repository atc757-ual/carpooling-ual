import { BASELINE_OCCUPANCY, Commuter, Population } from './population';
import type { Leg } from './ride-matcher';
import { slotOf, SLOT_COUNT } from './day-slots';

// Lo que deja un tramo (la ida o la vuelta): los vehículos y, aparte, lo de
// quienes iban en transporte público o de otra forma (accesibilidad)
export interface LegTally {
  vehicles: number;
  vehiclesBySlot: number[];
  // Pasajeros de otros modos que piden plaza y los que la consiguen
  otherModePassengers: number;
  otherModeCovered: number;
  // Coches que salen de más: los de quien iba en otro modo y conduce porque
  // ha conseguido pasajeros
  addedVehicles: number;
}

// Quien iba en coche y no comparte (no adopta, se queda sin plaza o conduce
// sin pasajeros) viaja como hoy: a 1,2 personas por coche. Quien iba en otro
// modo y no comparte sigue en su modo: no suma ningún coche. Un viaje
// compartido es un coche entero
export function tallyLeg(
  leg: Leg,
  population: Population,
  outcome: { unmatched: readonly Commuter[]; sharedIds: ReadonlySet<string> },
): LegTally {
  const { unmatched, sharedIds } = outcome;
  const shared = population.drivers.filter(({ id }) => sharedIds.has(id));
  const alone = [
    ...population.soloCommuters,
    ...unmatched,
    ...population.drivers.filter(({ id }) => !sharedIds.has(id)),
  ].filter((commuter) => commuter.isOtherMode !== true);
  const vehiclesBySlot = new Array<number>(SLOT_COUNT).fill(0);
  for (const commuter of alone) {
    vehiclesBySlot[slotOf(commuter, leg)] += 1 / BASELINE_OCCUPANCY;
  }
  for (const driver of shared) {
    vehiclesBySlot[slotOf(driver, leg)] += 1;
  }
  const unmatchedIds = new Set(unmatched.map(({ id }) => id));
  const otherModePassengers = population.passengers.filter(
    (passenger) => passenger.isOtherMode === true,
  );
  return {
    vehicles: alone.length / BASELINE_OCCUPANCY + shared.length,
    vehiclesBySlot,
    otherModePassengers: otherModePassengers.length,
    otherModeCovered: otherModePassengers.filter(
      ({ id }) => !unmatchedIds.has(id),
    ).length,
    addedVehicles: shared.filter((driver) => driver.isOtherMode === true)
      .length,
  };
}
