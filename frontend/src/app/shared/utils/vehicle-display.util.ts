import { Vehicle, VehicleColor, VehicleEngine } from '../../core/models/driver.model';

const COLOR_LABELS: Readonly<Record<VehicleColor, string>> = {
  white: 'Blanco',
  black: 'Negro',
  grey: 'Gris',
  silver: 'Plata',
  blue: 'Azul',
  red: 'Rojo',
  green: 'Verde',
  other: 'Otro',
};

const COLOR_SWATCHES: Readonly<Record<VehicleColor, string>> = {
  white: '#ffffff',
  black: '#202124',
  grey: '#808080',
  silver: '#c0c0c0',
  blue: '#2673c9',
  red: '#d83b3b',
  green: '#31865b',
  other: '#8b6f9b',
};

export function vehicleDisplayName(
  vehicle: Pick<Vehicle, 'brand' | 'model'> & Partial<Pick<Vehicle, 'plate'>>,
): string {
  return [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || (vehicle.plate ?? 'Coche');
}

export function vehicleColorLabel(color: VehicleColor | null): string {
  return color ? COLOR_LABELS[color] : 'Color sin indicar';
}

export function vehicleColorSwatch(color: VehicleColor | null): string {
  return color ? COLOR_SWATCHES[color] : 'transparent';
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

// «Gris · 4 plazas · Híbrido»: las plazas sin el conductor (como las cuenta
// la API) y el motor solo si es eléctrico o híbrido («otro» no aporta nada)
export function vehicleSpecs(vehicle: Pick<Vehicle, 'color' | 'capacity' | 'engine'>): string {
  const seats = `${vehicle.capacity} ${vehicle.capacity === 1 ? 'plaza' : 'plazas'}`;
  const engine = vehicle.engine ? ENGINE_LABELS[vehicle.engine] : undefined;
  return [vehicleColorLabel(vehicle.color), seats, engine].filter(Boolean).join(' · ');
}
