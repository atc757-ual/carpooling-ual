import { Vehicle, VehicleColor } from '../../core/models/driver.model';

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
