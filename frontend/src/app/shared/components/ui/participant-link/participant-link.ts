import { Component, computed, inject, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ModalController } from '@ionic/angular';
import { getFirstName } from '../../../utils/person-name.util';
import {
  openParticipantProfile,
  ParticipantRole,
} from '../../modals/participant-profile-modal/participant-profile-modal';

// El nombre de la otra persona del viaje como botón que abre su perfil
// («Ver el perfil de Lucía»). Lo que se proyecta es lo que se ve (el nombre,
// el nombre completo o el avatar)
@Component({
  selector: 'app-participant-link',
  imports: [TranslocoPipe],
  template: `<button
    class="participant-link"
    type="button"
    [attr.aria-label]="'participantProfile.open' | transloco: { name: firstName() }"
    (click)="open()"
  >
    <ng-content />
  </button>`,
  styleUrl: './participant-link.scss',
})
export class ParticipantLink {
  private readonly modalController = inject(ModalController);

  readonly tripId = input.required<string>();
  readonly userId = input.required<string>();
  readonly name = input.required<string>();
  readonly role = input.required<ParticipantRole>();

  readonly firstName = computed(() => getFirstName(this.name()));

  open(): Promise<void> {
    return openParticipantProfile(this.modalController, {
      tripId: this.tripId(),
      userId: this.userId(),
      name: this.name(),
      role: this.role(),
    });
  }
}
