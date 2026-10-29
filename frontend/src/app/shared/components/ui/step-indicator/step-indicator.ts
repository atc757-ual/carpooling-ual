import { Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { checkmark } from 'ionicons/icons';

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
  readonly steps = input.required<readonly string[]>();
  // El paso actual, de 1 en adelante
  readonly current = input.required<number>();
  // Terminado (el último paso hecho): todos con ✓ y sin volver a ninguno
  readonly isComplete = input(false);
  readonly selected = output<number>();

  protected readonly doneIcon = checkmark;
}
