import { FilterChipOption } from '../../shared/components/ui/filter-chips/filter-chips';

// Lo que se elige ver al final de la hoja de «En curso», en pastillas. Delante,
// una propia de cada pantalla mientras toca: «Bajada» (pasajero, lejos del
// campus en la ida) o «Viaje» (conductor, para terminarlo antes de llegar).
// Después, la seguridad (al abrir) y las acciones (reportar). El SOS va
// siempre a la vista, junto a ellas
export type RideSheetTab = 'early' | 'finish' | 'safety' | 'actions';

export const EARLY_TAB: FilterChipOption = { value: 'early', label: 'Bajada' };
export const FINISH_TAB: FilterChipOption = { value: 'finish', label: 'Viaje' };
const BASE_OPTIONS: readonly FilterChipOption[] = [
  { value: 'safety', label: 'Seguridad' },
  { value: 'actions', label: 'Acciones' },
];
const TAB_VALUES: ReadonlySet<string> = new Set(['early', 'finish', 'safety', 'actions']);

export function buildRideSheetTabs(first: FilterChipOption | null): readonly FilterChipOption[] {
  return first ? [first, ...BASE_OPTIONS] : BASE_OPTIONS;
}

export function isRideSheetTab(value: string | null): value is RideSheetTab {
  return value !== null && TAB_VALUES.has(value);
}

// La pestaña que se ve: si la elegida era la propia de la pantalla y ya no se
// ofrece (se ha acercado al destino), vuelve a la de seguridad
export function resolveRideSheetTab(
  chosen: RideSheetTab,
  first: FilterChipOption | null,
): RideSheetTab {
  const isBase = chosen === 'safety' || chosen === 'actions';
  return isBase || chosen === first?.value ? chosen : 'safety';
}
