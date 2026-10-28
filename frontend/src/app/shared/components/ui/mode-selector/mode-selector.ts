import { Component, inject } from '@angular/core';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonLabel,
  IonNote,
  IonSegment,
  IonSegmentButton,
} from '@ionic/angular';
import { ApiError } from '../../../../core/models/api-error.model';
import { ToastService } from '../../../../core/services/ui/toast.service';
import { ActiveModeService, TravelMode } from '../../../../core/services/users/active-mode.service';
import { getErrorMessage } from '../../../utils/error-message.util';

// Modo activo (pasajero o conductor) de quien tiene los dos perfiles, en una
// tarjeta con un selector de dos mitades (Pasajero | Conductor). Con un solo
// perfil no hay nada que cambiar y no se muestra. Cambiarlo cambia la tercera
// pestaña (Buscar o Publicar) y lo que ofrece Inicio
@Component({
  selector: 'app-mode-selector',
  imports: [
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonLabel,
    IonNote,
    IonSegment,
    IonSegmentButton,
  ],
  templateUrl: './mode-selector.html',
  styleUrl: './mode-selector.scss',
})
export class ModeSelector {
  private readonly activeMode = inject(ActiveModeService);
  private readonly toast = inject(ToastService);

  readonly isVisible = this.activeMode.hasBothModes;
  readonly mode = this.activeMode.mode;

  // El segmento da su valor sin tipo: solo se aceptan los dos modos. Si el
  // servidor no lo guarda, el modo vuelve al anterior y se avisa
  async handleModeChange(value: string | number | undefined): Promise<void> {
    if (value !== 'passenger' && value !== 'driver') {
      return;
    }
    try {
      await this.activeMode.setMode(value satisfies TravelMode);
    } catch (error) {
      void this.toast.showError(getErrorMessage(ApiError.fromHttpError(error)));
    }
  }
}
