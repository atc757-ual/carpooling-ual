import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { constructOutline } from 'ionicons/icons';
import { AdminSection } from './admin-sections';

// Sección del panel aún sin contenido: su título y un estado vacío. Cada PR
// del panel la sustituye por la pantalla real de su sección
@Component({
  selector: 'app-admin-section-page',
  imports: [IonIcon],
  templateUrl: './admin-section.page.html',
  styleUrl: './admin-section.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSectionPage {
  // Llega de los datos de la ruta (withComponentInputBinding)
  readonly section = input.required<AdminSection>();

  protected readonly pendingIcon = constructOutline;
}
