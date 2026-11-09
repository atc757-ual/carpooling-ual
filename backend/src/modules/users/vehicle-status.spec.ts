import { VEHICLE_STATUSES } from './entities/vehicle.entity';
import type { VehicleStatus } from './entities/vehicle.entity';
import { canChangeVehicleStatus } from './vehicle-status';

// Todas las combinaciones (RNF-10): solo las de la tabla están permitidas
const ALLOWED = new Set([
  'available→on_trip',
  'available→inactive',
  'on_trip→available',
  'inactive→available',
]);

describe('canChangeVehicleStatus', () => {
  const pairs = VEHICLE_STATUSES.flatMap((from) =>
    VEHICLE_STATUSES.map((to) => [from, to] as [VehicleStatus, VehicleStatus]),
  );

  it.each(pairs)('%s → %s', (from, to) => {
    expect(canChangeVehicleStatus(from, to)).toBe(ALLOWED.has(`${from}→${to}`));
  });
});
