import { Component, computed, input } from '@angular/core';
import { TripDriver as Driver } from '../../../core/models/trip-result.model';

const RATING_FORMAT = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// «Lucía Cortés» → «LC» (las iniciales hacen de foto)
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

// «Lucía Cortés» → «Lucía» («Ver viaje de Lucía», «Lucía decide»)
export function getFirstName(name: string): string {
  return name.trim().split(/\s+/)[0];
}

// Quien conduce (person de la guía): las iniciales en un círculo, el nombre,
// sus viajes y si tiene el correo UAL verificado, y la valoración a la derecha.
// En los resultados y en el detalle del viaje
@Component({
  selector: 'app-trip-driver',
  templateUrl: './trip-driver.html',
  styleUrl: './trip-driver.scss',
})
export class TripDriver {
  readonly driver = input.required<Driver>();

  readonly initials = computed(() => getInitials(this.driver().name));
  readonly rating = computed(() => RATING_FORMAT.format(this.driver().rating));

  // «42 viajes · Correo UAL verificado»
  readonly details = computed(() => {
    const { tripCount, isEmailVerified } = this.driver();
    const trips = tripCount === 1 ? '1 viaje' : `${tripCount} viajes`;
    return isEmailVerified ? `${trips} · Correo UAL verificado` : trips;
  });
}
