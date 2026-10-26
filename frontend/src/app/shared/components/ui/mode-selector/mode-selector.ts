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
import { ActiveModeService, TravelMode } from '../../../../core/services/users/active-mode.service';

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

  readonly isVisible = this.activeMode.hasBothModes;
  readonly mode = this.activeMode.mode;

  // El segmento da su valor sin tipo: solo se aceptan los dos modos
  handleModeChange(value: string | number | undefined): void {
    if (value === 'passenger' || value === 'driver') {
      void this.activeMode.setMode(value satisfies TravelMode);
    }
  }
}
