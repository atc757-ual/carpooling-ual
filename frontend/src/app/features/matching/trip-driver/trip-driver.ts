import { Component, computed, inject, input, resource } from '@angular/core';
import { TranslocoPipe, translate } from '@jsverse/transloco';
import { TripDriver as Driver } from '../../../core/models/trip-result.model';
import { AvatarsService } from '../../../core/services/users/avatars.service';
import { IonIcon, ModalController } from '@ionic/angular';
import { AvatarArt } from '../../../shared/components/ui/avatar-art/avatar-art';
import { numberFormat } from '../../../core/i18n/app-locale';
import { ParticipantLink } from '../../../shared/components/ui/participant-link/participant-link';
import { getInitials } from '../../../shared/utils/person-name.util';
import { RATING_ICON } from '../../../shared/utils/rating.util';

const RATING_FORMAT = () =>
  numberFormat({
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

// Viven en shared/utils; se reexportan aquí para quien ya los importaba
export { getFirstName, getInitials } from '../../../shared/utils/person-name.util';

// «1 viaje», «42 viajes»
function formatTripCount(count: number): string {
  return translate(count === 1 ? 'labels.trips.one' : 'labels.trips.other', { count });
}

// Quien conduce (person de la guía): las iniciales en un círculo, el nombre,
// sus viajes y si tiene el correo UAL verificado, y la valoración a la derecha.
// En los resultados y en el detalle del viaje
@Component({
  selector: 'app-trip-driver',
  imports: [AvatarArt, IonIcon, ParticipantLink, TranslocoPipe],
  templateUrl: './trip-driver.html',
  styleUrl: './trip-driver.scss',
})
export class TripDriver {
  readonly driver = input.required<Driver>();
  readonly showRating = input(true);
  // El viaje en el que se comparte plaza con quien conduce: con él, su nombre
  // abre su perfil (con la plaza aceptada, en el detalle de la solicitud)
  readonly profileTripId = input<string | null>(null);
  private readonly avatars = inject(AvatarsService);
  private readonly modalController = inject(ModalController);

  protected readonly medalIcon = RATING_ICON;

  readonly initials = computed(() => getInitials(this.driver().name));
  readonly avatarSvg = resource({
    params: () => this.driver().avatarKey ?? undefined,
    loader: ({ params }) => this.avatars.getGraphic(params),
  });
  // «4,8», o null si aún no tiene valoración
  readonly rating = computed(() => {
    const { rating } = this.driver();
    return rating === undefined ? null : RATING_FORMAT().format(rating);
  });

  // «42 viajes» o «Nuevo conductor»
  readonly details = computed(() => {
    const { tripCount, rating } = this.driver();
    if (rating === undefined) {
      return translate('labels.newDriver');
    }
    if (tripCount === undefined) {
      return null;
    }
    return formatTripCount(tripCount);
  });

  // Sus valoraciones en una ventana (desde los resultados, sin entrar al viaje).
  // La ventana se carga al pulsar: así no se importan la una a la otra
  async openReviews(): Promise<void> {
    const { id, name } = this.driver();
    const { DriverReviewsModal } = await import('../driver-reviews-modal/driver-reviews-modal');
    const modal = await this.modalController.create({
      component: DriverReviewsModal,
      cssClass: ['info-dialog', 'list-dialog'],
      componentProps: { driverId: id, driverName: name },
    });
    await modal.present();
  }
}
