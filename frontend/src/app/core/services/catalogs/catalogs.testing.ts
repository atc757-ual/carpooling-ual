import { Provider, signal } from '@angular/core';
import { LanguageService } from '../ui/language.service';
import { CatalogsService, TravelPreferenceOptionItem, VehicleColorItem } from './catalogs.service';

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

// Las 11 opciones de las preferencias (migración AddTravelPreferenceOptions)
export const TRAVEL_PREFERENCE_OPTIONS_FIXTURE: TravelPreferenceOptionItem[] = (
  [
    ['conversation', 'chatty', 'Charlar', 'Chatting'],
    ['conversation', 'depends', 'Según el día', 'Depends on the day'],
    ['conversation', 'quiet', 'Ir tranquilo', 'Quiet trip'],
    ['music', 'any', 'Con música', 'With music'],
    ['music', 'soft', 'Música suave', 'Soft music'],
    ['music', 'none', 'Sin música', 'No music'],
    ['smoking', 'no', 'No se fuma', 'No smoking'],
    ['smoking', 'allowed', 'Se puede fumar', 'Smoking allowed'],
    ['pets', 'none', 'Sin mascotas', 'No pets'],
    ['pets', 'small_carrier', 'En transportín', 'In a carrier'],
    ['pets', 'pet_friendly', 'Pet friendly', 'Pet friendly'],
  ] as const
).map(([preference, value, name, nameEn]) => ({
  key: `${preference}-${value}`,
  preference,
  value,
  name,
  nameEn,
  isActive: true,
}));

// Catálogos sin red (los colores y las opciones de arriba y unas pocas
// marcas) y la app en español, sin Transloco
export function provideCatalogsForTests(
  colors: VehicleColorItem[] = VEHICLE_COLORS_FIXTURE,
): Provider[] {
  return [
    {
      provide: CatalogsService,
      useValue: {
        vehicleColors: () => Promise.resolve(colors),
        vehicleBrandNames: () => Promise.resolve(['Abarth', 'SEAT', 'Škoda']),
        travelPreferenceOptions: () => Promise.resolve(TRAVEL_PREFERENCE_OPTIONS_FIXTURE),
      },
    },
    { provide: LanguageService, useValue: { currentLanguage: signal('es') } },
  ];
}
