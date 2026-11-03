import { Component, computed, inject, input, resource } from '@angular/core';
import { TripDriver as Driver } from '../../../core/models/trip-result.model';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { ModalController } from '@ionic/angular';
import { AvatarArt } from '../../../shared/components/ui/avatar-art/avatar-art';

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
  imports: [AvatarArt],
  templateUrl: './trip-driver.html',
  styleUrl: './trip-driver.scss',
})
export class TripDriver {
  readonly driver = input.required<Driver>();
  private readonly avatars = inject(AvatarsService);
  private readonly modalController = inject(ModalController);

  readonly initials = computed(() => getInitials(this.driver().name));
  readonly avatarSvg = resource({
    params: () => this.driver().avatarKey ?? undefined,
    loader: ({ params }) => this.avatars.getGraphic(params),
  });
  // «4,8», o null si aún no tiene valoración
  readonly rating = computed(() => {
    const { rating } = this.driver();
    return rating === undefined ? null : RATING_FORMAT.format(rating);
  });

  // «42 viajes · Correo UAL verificado» (cada parte, si se sabe)
  readonly details = computed(() => {
    const { tripCount, rating, isEmailVerified } = this.driver();
    let tripDetails: string | null;
    if (rating === undefined) {
      tripDetails = 'Nuevo conductor';
    } else if (tripCount === undefined) {
      tripDetails = null;
    } else {
      tripDetails = formatTripCount(tripCount);
    }
    const parts = [tripDetails, isEmailVerified ? 'Correo UAL verificado' : null];
    return parts.filter(Boolean).join(' · ');
  });

  // Sus valoraciones en una ventana (desde los resultados, sin entrar al viaje).
  // La ventana se carga al pulsar: así no se importan la una a la otra
  async openReviews(): Promise<void> {
    const { id, name } = this.driver();
    const { DriverReviewsModal } = await import('../driver-reviews-modal/driver-reviews-modal');
    const modal = await this.modalController.create({
      component: DriverReviewsModal,
      cssClass: 'info-dialog',
      componentProps: { driverId: id, driverName: name },
    });
    await modal.present();
  }
}
