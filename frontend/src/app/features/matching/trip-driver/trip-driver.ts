import { Component, computed, inject, input, resource } from '@angular/core';
import { TripDriver as Driver } from '../../../core/models/trip-result.model';
import { AvatarsService } from '../../../core/services/users/avatars.service';

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

// «1 viaje», «42 viajes»
function formatTripCount(count: number): string {
  return count === 1 ? '1 viaje' : `${count} viajes`;
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
  private readonly avatars = inject(AvatarsService);

  readonly initials = computed(() => getInitials(this.driver().name));
  readonly avatarSvg = resource({
    params: () => this.driver().avatarKey ?? undefined,
    loader: ({ params }) => this.avatars.getSvg(params),
  });
  // «4,8», o null si aún no tiene valoración
  readonly rating = computed(() => {
    const { rating } = this.driver();
    return rating === undefined ? null : RATING_FORMAT.format(rating);
  });

  // «42 viajes · Correo UAL verificado» (cada parte, si se sabe)
  readonly details = computed(() => {
    const { tripCount, rating, isEmailVerified } = this.driver();
    const parts = [
      rating === undefined
        ? 'Nuevo conductor'
        : tripCount === undefined
          ? null
          : formatTripCount(tripCount),
      isEmailVerified ? 'Correo UAL verificado' : null,
    ];
    return parts.filter(Boolean).join(' · ');
  });
}
