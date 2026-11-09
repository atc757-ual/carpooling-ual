import type { VehicleStatus } from './entities/vehicle.entity';

// Transiciones permitidas del vehículo (RF-11, RNF-10), en una única tabla:
// - disponible → en viaje (al iniciar un viaje) o dado de baja (el conductor)
// - en viaje → disponible (al terminar o cancelar el viaje); no se puede dar
//   de baja hasta entonces
// - dado de baja → disponible (el mismo conductor vuelve a registrar la
//   matrícula)
const VEHICLE_TRANSITIONS: Readonly<
  Record<VehicleStatus, readonly VehicleStatus[]>
> = {
  available: ['on_trip', 'inactive'],
  on_trip: ['available'],
  inactive: ['available'],
};

export function canChangeVehicleStatus(
  from: VehicleStatus,
  to: VehicleStatus,
): boolean {
  return VEHICLE_TRANSITIONS[from].includes(to);
}
