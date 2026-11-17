import { FilterChipOption } from '../../../shared/components/ui/filter-chips/filter-chips';

// Lo que el pasajero elige ver al final de la hoja de «En curso», en pastillas:
// «Bajada» (bajarse antes; solo lejos del campus, en la ida), su seguridad (al abrir)
// y las acciones de su plaza. El SOS va siempre a la vista, junto a ellas
export type RideSheetTab = 'early' | 'safety' | 'actions';

const EARLY_OPTION: FilterChipOption = { value: 'early', label: 'Bajada' };
const BASE_OPTIONS: readonly FilterChipOption[] = [
  { value: 'safety', label: 'Seguridad' },
  { value: 'actions', label: 'Acciones' },
];
const TAB_VALUES: ReadonlySet<string> = new Set(['early', 'safety', 'actions']);

export function buildRideSheetTabs(hasEarly: boolean): readonly FilterChipOption[] {
  return hasEarly ? [EARLY_OPTION, ...BASE_OPTIONS] : BASE_OPTIONS;
}

export function isRideSheetTab(value: string | null): value is RideSheetTab {
  return value !== null && TAB_VALUES.has(value);
}

// La pestaña que se ve: si estaba en «Bajada» y ya no se ofrece (se ha
// acercado al campus), vuelve a la de seguridad
export function resolveRideSheetTab(chosen: RideSheetTab, hasEarly: boolean): RideSheetTab {
  return chosen === 'early' && !hasEarly ? 'safety' : chosen;
}
