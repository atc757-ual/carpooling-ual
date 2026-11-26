import { Component, computed, inject, Input, resource } from '@angular/core';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { IonChip, IonIcon, IonItem, IonLabel, IonList, ModalController } from '@ionic/angular';
import { alertCircleOutline, mailOutline } from 'ionicons/icons';
import { numberFormat } from '../../../../core/i18n/app-locale';
import { ApiError } from '../../../../core/models/api-error.model';
import { ParticipantProfile } from '../../../../core/models/participant-profile.model';
import { TravelPreferencesStore } from '../../../../core/services/catalogs/travel-preferences.store';
import { TripParticipantsService } from '../../../../core/services/trips/trip-participants.service';
import { AvatarsService } from '../../../../core/services/users/avatars.service';
import { getErrorMessage } from '../../../utils/error-message.util';
import { AvatarArt } from '../../ui/avatar-art/avatar-art';
import { EmptyState } from '../../ui/empty-state/empty-state';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { getFirstName, getInitials } from '../../../utils/person-name.util';
import { ModalHeader } from '../modal-header/modal-header';
import { localizedComputed } from '../../../../core/i18n/localized-computed';

export type ParticipantRole = 'driver' | 'passenger';

const RATING_FORMAT = () =>
  numberFormat({
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

// «4,8 · 12 valoraciones», o «Aún sin valoraciones»
export function formatParticipantRating(
  profile: ParticipantProfile,
  role: ParticipantRole,
): string {
  const { averageRating, ratingCount } = profile.ratings[role];
  if (averageRating === null || ratingCount === 0) {
    return translate('participantProfile.noRatings');
  }
  const count = translate(
    ratingCount === 1 ? 'labels.rating.reviews.one' : 'labels.rating.reviews.other',
    { count: ratingCount },
  );
  return `${RATING_FORMAT().format(averageRating)} · ${count}`;
}

export interface ParticipantProfileTarget {
  tripId: string;
  userId: string;
  name: string;
  role: ParticipantRole;
}

// Abre el perfil de la otra persona del viaje (desde el detalle de la
// solicitud, «Pasajeros» o «En curso»)
export async function openParticipantProfile(
  modalController: ModalController,
  target: ParticipantProfileTarget,
): Promise<void> {
  const modal = await modalController.create({
    component: ParticipantProfileModal,
    cssClass: 'info-dialog',
    componentProps: { ...target },
  });
  await modal.present();
}

// Con quién se viaja: el perfil del conductor (para sus pasajeros) o de un
// pasajero con plaza (para el conductor). Nombre completo, valoración en su
// papel, «Sobre mí», preferencias y el correo (el teléfono no: para llamar
// están los botones del viaje en curso)
@Component({
  selector: 'app-participant-profile-modal',
  imports: [
    AvatarArt,
    EmptyState,
    IonChip,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    LoadingState,
    ModalHeader,
    TranslocoPipe,
  ],
  templateUrl: './participant-profile-modal.html',
  styleUrl: './participant-profile-modal.scss',
})
export class ParticipantProfileModal {
  private readonly modalController = inject(ModalController);
  private readonly participants = inject(TripParticipantsService);
  private readonly avatars = inject(AvatarsService);
  private readonly travelPreferences = inject(TravelPreferencesStore);

  @Input() tripId = '';
  @Input() userId = '';
  // El nombre que ya se conoce, para el título mientras carga
  @Input() name = '';
  // En qué papel viaja la persona del perfil (qué valoración se enseña)
  @Input() role: ParticipantRole = 'passenger';

  protected readonly errorIcon = alertCircleOutline;
  protected readonly mailIcon = mailOutline;

  readonly profile = resource({
    loader: () => this.participants.getProfile(this.tripId, this.userId),
  });

  // El perfil, o null mientras carga o si ha fallado (value() lanza un error
  // con el resource en error)
  readonly person = computed(() => (this.profile.hasValue() ? this.profile.value() : null));

  readonly avatarSvg = resource({
    params: () => this.person()?.avatarKey ?? undefined,
    loader: ({ params }) => this.avatars.getGraphic(params),
  });

  readonly title = localizedComputed(() =>
    translate('participantProfile.title', {
      name: getFirstName(this.person()?.name ?? this.name),
    }),
  );
  readonly initials = computed(() => getInitials(this.person()?.name ?? ''));
  readonly rating = localizedComputed(() => {
    const person = this.person();
    return person ? formatParticipantRating(person, this.role) : '';
  });
  readonly preferences = computed(() => this.travelPreferences.format(this.person()?.preferences));
  readonly errorMessage = localizedComputed(() => {
    const error = this.profile.error();
    return error ? getErrorMessage(ApiError.fromHttpError(error)) : null;
  });

  close(): Promise<boolean> {
    return this.modalController.dismiss();
  }
}
