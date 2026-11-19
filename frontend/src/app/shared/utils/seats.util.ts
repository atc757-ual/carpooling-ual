import { translate } from '@jsverse/transloco';

// «1 plaza», «3 plazas»
export function formatSeats(seats: number): string {
  return translate(seats === 1 ? 'labels.seats.one' : 'labels.seats.other', { count: seats });
}

// Corto, para la rejilla de datos (con la etiqueta «Plazas libres»): «2 de 3» o «Completo»
export function formatAvailableSeats(available: number, offered: number): string {
  return available <= 0
    ? translate('labels.seats.full')
    : translate('labels.seats.availableOf', { available, offered });
}
