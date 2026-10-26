export type CampusEntranceId = 'north' | 'south' | 'east';

export interface CampusEntrance {
  id: CampusEntranceId;
  label: string;
}

export const DEFAULT_ENTRANCE: CampusEntranceId = 'north';

// Entradas del Campus UAL (La Cañada) a las que se puede ir o de las que se
// puede salir
export const CAMPUS_ENTRANCES: readonly CampusEntrance[] = [
  { id: 'north', label: 'Campus UAL · Ingreso norte' },
  { id: 'south', label: 'Campus UAL · Ingreso sur' },
  { id: 'east', label: 'Campus UAL · Ingreso este' },
];

export function getEntranceLabel(id: CampusEntranceId): string {
  return CAMPUS_ENTRANCES.find((entrance) => entrance.id === id)?.label ?? '';
}
