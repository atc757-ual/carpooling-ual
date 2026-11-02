import { Provider } from '@angular/core';
import { CatalogsService, VehicleColorItem } from './catalogs.service';

// Los 8 colores del catálogo (migración AddVehicleColors), para los tests
export const VEHICLE_COLORS_FIXTURE: VehicleColorItem[] = [
  ['white', 'Blanco', '#ffffff'],
  ['black', 'Negro', '#202124'],
  ['grey', 'Gris', '#808080'],
  ['silver', 'Plata', '#c0c0c0'],
  ['blue', 'Azul', '#2673c9'],
  ['red', 'Rojo', '#d83b3b'],
  ['green', 'Verde', '#31865b'],
  ['other', 'Otro', '#8b6f9b'],
].map(([key, name, hex]) => ({ key, name, hexLight: hex, hexDark: hex, isActive: true }));

// Catálogos sin red: los colores de arriba y unas pocas marcas
export function provideCatalogsForTests(
  colors: VehicleColorItem[] = VEHICLE_COLORS_FIXTURE,
): Provider {
  return {
    provide: CatalogsService,
    useValue: {
      vehicleColors: () => Promise.resolve(colors),
      vehicleBrandNames: () => Promise.resolve(['Abarth', 'SEAT', 'Škoda']),
    },
  };
}
