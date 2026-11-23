import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IonIcon, ModalController } from '@ionic/angular';
import { chevronForward } from 'ionicons/icons';
import { getFirstName } from '../../../utils/person-name.util';
import {
  openParticipantProfile,
  ParticipantRole,
} from '../../modals/participant-profile-modal/participant-profile-modal';

// El nombre de la otra persona del viaje como botón que abre su perfil
// («Ver el perfil de Lucía»). Lo que se proyecta es lo que se ve (el nombre,
// el nombre completo), con un chevron detrás para que se vea que abre algo
@Component({
  selector: 'app-participant-link',
  imports: [IonIcon, TranslocoPipe],
  template: `<button
    class="participant-link"
    type="button"
    [attr.aria-label]="'participantProfile.open' | transloco: { name: firstName() }"
    (click)="open()"
  >
    <ng-content />
    <ion-icon class="participant-link__chevron" [icon]="chevronIcon" aria-hidden="true" />
  </button>`,
  styleUrl: './participant-link.scss',
})
export class ParticipantLink {
  private readonly modalController = inject(ModalController);

  readonly tripId = input.required<string>();
  readonly userId = input.required<string>();
  readonly name = input.required<string>();
  // En qué papel viaja (no se llama role: sería el atributo ARIA del elemento)
  readonly participantRole = input.required<ParticipantRole>();

  readonly firstName = computed(() => getFirstName(this.name()));
  protected readonly chevronIcon = chevronForward;

  open(): Promise<void> {
    return openParticipantProfile(this.modalController, {
      tripId: this.tripId(),
      userId: this.userId(),
      name: this.name(),
      role: this.participantRole(),
    });
  }
}
