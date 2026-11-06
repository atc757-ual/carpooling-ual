import { Component, computed, inject, input, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { IonIcon } from '@ionic/angular';
import { TRANSLOCO_TRANSPILER, TranslocoService } from '@jsverse/transloco';
import { checkmark } from 'ionicons/icons';
import { EMPTY } from 'rxjs';

// Pasos de un formulario largo (Publicar: Trayecto · Vehículo · Revisión · Publicado): cada uno
// con su número en un círculo y su nombre. Los hechos, en azul con ✓ y se
// puede volver a ellos; el actual, en azul y en negrita; los siguientes, en
// gris. Avisa con «selected» (de 1 en adelante) al pulsar uno hecho. Al
// terminar (isComplete), todos hechos y sin poder volver
@Component({
  selector: 'app-step-indicator',
  imports: [IonIcon],
  templateUrl: './step-indicator.html',
  styleUrl: './step-indicator.scss',
})
export class StepIndicator {
  private readonly transpiler = inject(TRANSLOCO_TRANSPILER, { optional: true });
  private readonly transloco = this.transpiler
    ? inject(TranslocoService, { optional: true })
    : null;
  private readonly translation = toSignal(this.transloco?.selectTranslation() ?? EMPTY);

  readonly steps = input.required<readonly string[]>();
  // El paso actual, de 1 en adelante
  readonly current = input.required<number>();
  // Terminado (el último paso hecho): todos con ✓ y sin volver a ninguno
  readonly isComplete = input(false);
  // Con false, los pasos hechos no se pueden pulsar (p. ej. el progreso de un
  // viaje, que solo informa)
  readonly isNavigable = input(true);
  // Nombre accesible de la lista
  readonly label = input('Pasos');
  readonly selected = output<number>();

  protected readonly captionText = computed(() => {
    const current = this.current();
    const total = this.steps().length;
    const step = this.steps()[current - 1] ?? '';
    if (this.transloco && this.translation()) {
      return this.transloco.translate('common.steps.caption', {
        current,
        total,
        step: `<b>${step}</b>`,
      });
    }
    return `Paso ${current} de ${total} · <b>${step}</b>`;
  });

  protected readonly doneIcon = checkmark;
}
