import { Vehicle, VehicleEngine } from '../../core/models/driver.model';

export function vehicleDisplayName(
  vehicle: Pick<Vehicle, 'brand' | 'model'> & Partial<Pick<Vehicle, 'plate'>>,
): string {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || (vehicle.plate ?? 'Coche');
}

const SPANISH_PLATE = /^(\d{4})\s?([A-Z]{3})$/;

const ENGINE_LABELS: Partial<Record<VehicleEngine, string>> = {
  electric: 'Eléctrico',
  hybrid: 'Híbrido',
};

// «1234BGG» → «1234 BGG», como se escribe la matrícula española actual; las
// demás, tal cual
export function formatPlate(plate: string): string {
  return plate.replace(SPANISH_PLATE, '$1 $2');
}

// «Gris · 4 plazas · Híbrido»: el nombre del color (del catálogo), las plazas
// sin el conductor (como las cuenta la API) y el motor solo si es eléctrico o
// híbrido («otro» no aporta nada)
export function vehicleSpecs(
  vehicle: Pick<Vehicle, 'capacity' | 'engine'>,
  colorLabel: string,
): string {
  const seats = `${vehicle.capacity} ${vehicle.capacity === 1 ? 'plaza' : 'plazas'}`;
  const engine = vehicle.engine ? ENGINE_LABELS[vehicle.engine] : undefined;
  return [colorLabel, seats, engine].filter(Boolean).join(' · ');
}
