import { CampusEntranceId } from '../../core/models/trip-search.model';

export interface CampusEntrance {
  id: CampusEntranceId;
  // «Campus UAL · Ingreso norte» (selector y textos de una línea)
  label: string;
  // «Ingreso norte» (debajo de «Campus UAL», como en el resumen)
  name: string;
}

export const DEFAULT_ENTRANCE: CampusEntranceId = 'north';

export const CAMPUS_NAME = 'Campus UAL';

// Entradas del Campus UAL (La Cañada) a las que se puede ir o de las que se
// puede salir
export const CAMPUS_ENTRANCES: readonly CampusEntrance[] = [
  { id: 'north', label: 'Campus UAL · Ingreso norte', name: 'Ingreso norte' },
  { id: 'south', label: 'Campus UAL · Ingreso sur', name: 'Ingreso sur' },
  { id: 'east', label: 'Campus UAL · Ingreso este', name: 'Ingreso este' },
];

export function getEntranceName(id: CampusEntranceId): string {
  return CAMPUS_ENTRANCES.find((entrance) => entrance.id === id)?.name ?? '';
}
