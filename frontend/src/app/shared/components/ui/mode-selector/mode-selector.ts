import { Component, computed, inject, input } from '@angular/core';
import { IonSelect, IonSelectOption } from '@ionic/angular';
import { ActiveModeService, TravelMode } from '../../../../core/services/users/active-mode.service';

const MODE_LABELS: Readonly<Record<TravelMode, string>> = {
  passenger: 'Pasajero',
  driver: 'Conductor',
};

// - inline: en una línea (franja «¡Hola!» de escritorio).
// - card: recuadro con los perfiles habilitados debajo (Inicio en el móvil).
export type ModeSelectorVariant = 'inline' | 'card';

// Modo activo (pasajero o conductor) de quien tiene los dos perfiles, con
// «Cambiar» para pasar al otro. Con un solo perfil no hay nada que cambiar y
// no se muestra. Cambiarlo cambia la tercera pestaña (Buscar o Publicar)
@Component({
  selector: 'app-mode-selector',
  imports: [IonSelect, IonSelectOption],
  templateUrl: './mode-selector.html',
  styleUrl: './mode-selector.scss',
  host: { '[class.mode-selector--card]': "variant() === 'card'" },
})
export class ModeSelector {
  private readonly activeMode = inject(ActiveModeService);

  readonly variant = input<ModeSelectorVariant>('inline');

  readonly isVisible = this.activeMode.hasBothModes;
  readonly mode = this.activeMode.mode;
  readonly modeLabel = computed(() => {
    const mode = this.mode();
    return mode ? MODE_LABELS[mode] : '';
  });

  protected readonly modeLabels = MODE_LABELS;

  handleModeChange(mode: TravelMode): void {
    void this.activeMode.setMode(mode);
  }
}
